import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { logMoisture, logVariable, logWaste, useStore } from "@/lib/store";
import { mockDb } from "@/data/mock-data";
import type { Lot, VariableDefinition } from "@/types/domain";

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: Lot;
}

// ───────── Variable register dialog ─────────

export function RegisterVariableDialog({ open, onOpenChange, lot }: BaseProps) {
  const definitions = useStore((s) => s.variableDefinitions);
  const phaseId = lot.current_phase_id;
  const phase = mockDb.processPhaseInstances
    .concat([])
    .find((p) => p.id === phaseId);
  const phaseName = phase?.name ?? "";

  const required = definitions.filter((d) => d.phase_associations.includes(phaseName));
  const optional = definitions.filter((d) => !d.phase_associations.includes(phaseName));
  const ordered = [...required, ...optional];

  const [variableId, setVariableId] = useState<string>(ordered[0]?.id ?? "");
  const def = definitions.find((d) => d.id === variableId);

  const [valueNumber, setValueNumber] = useState<string>("");
  const [valueText, setValueText] = useState<string>("");
  const [valueBoolean, setValueBoolean] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  const reset = () => {
    setValueNumber("");
    setValueText("");
    setValueBoolean(false);
    setNotes("");
  };

  const handleSubmit = () => {
    if (!def) return;
    const payload: Parameters<typeof logVariable>[0] = {
      variable_id: def.id,
      lot_id: lot.id,
      phase_instance_id: phaseId ?? null,
      notes: notes.trim() || null,
    };
    if (def.value_type === "number" || def.value_type === "percentage" || def.value_type === "scale_5" || def.value_type === "custom_unit") {
      const schema = z
        .number({ invalid_type_error: "Debe ser un número" })
        .min(def.min_value ?? -Infinity, `Mínimo ${def.min_value}`)
        .max(def.max_value ?? Infinity, `Máximo ${def.max_value}`);
      const parsed = schema.safeParse(Number(valueNumber));
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Valor inválido");
        return;
      }
      payload.value_number = parsed.data;
      // Out-of-ideal-range warning
      if (
        (def.ideal_min != null && parsed.data < def.ideal_min) ||
        (def.ideal_max != null && parsed.data > def.ideal_max)
      ) {
        toast.warning(`Fuera del rango ideal (${def.ideal_min ?? "—"} a ${def.ideal_max ?? "—"} ${def.unit ?? ""})`);
      }
    } else if (def.value_type === "boolean") {
      payload.value_boolean = valueBoolean;
    } else if (def.value_type === "single_select" || def.value_type === "multi_select") {
      const schema = z.string().trim().min(1, "Selecciona una opción");
      const parsed = schema.safeParse(valueText);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Valor inválido");
        return;
      }
      payload.value_text = parsed.data;
      payload.value_options = def.value_type === "multi_select" ? [parsed.data] : null;
    } else {
      const schema = z.string().trim().min(1, "Campo requerido").max(2000);
      const parsed = schema.safeParse(valueText);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Valor inválido");
        return;
      }
      payload.value_text = parsed.data;
    }

    logVariable(payload);
    toast.success(`${def.name} registrada`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar variable</DialogTitle>
          <DialogDescription>
            Lote {lot.lot_code} · Fase {phaseName || "sin definir"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Variable</Label>
            <Select value={variableId} onValueChange={(v) => { setVariableId(v); reset(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {required.length > 0 && (
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Sugeridas para esta fase
                  </div>
                )}
                {required.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}{d.unit ? ` (${d.unit})` : ""}</SelectItem>
                ))}
                {optional.length > 0 && (
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Otras variables
                  </div>
                )}
                {optional.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}{d.unit ? ` (${d.unit})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {def?.description && (
              <p className="text-xs text-muted-foreground">{def.description}</p>
            )}
          </div>

          {def && <VariableValueInput
            def={def}
            valueNumber={valueNumber}
            setValueNumber={setValueNumber}
            valueText={valueText}
            setValueText={setValueText}
            valueBoolean={valueBoolean}
            setValueBoolean={setValueBoolean}
          />}

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VariableValueInput({
  def,
  valueNumber,
  setValueNumber,
  valueText,
  setValueText,
  valueBoolean,
  setValueBoolean,
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
        <Input
          type="number"
          inputMode="decimal"
          value={valueNumber}
          onChange={(e) => setValueNumber(e.target.value)}
        />
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
            <Button
              key={n}
              type="button"
              variant={valueNumber === String(n) ? "default" : "outline"}
              size="sm"
              onClick={() => setValueNumber(String(n))}
              className="flex-1"
            >
              {n}
            </Button>
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
            {(def.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
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
          <p>La carga de {t === "photo" ? "fotos" : "archivos"} estará disponible al conectar el almacenamiento.</p>
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

// ───────── Moisture dialog ─────────

const moistureSchema = z.object({
  pct: z.number().min(0).max(40),
  device: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

export function RegisterMoistureDialog({ open, onOpenChange, lot }: BaseProps) {
  const [pct, setPct] = useState("");
  const [device, setDevice] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const parsed = moistureSchema.safeParse({
      pct: Number(pct),
      device: device || undefined,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Valor inválido");
      return;
    }
    logMoisture({
      lot_id: lot.id,
      moisture_pct: parsed.data.pct,
      device: parsed.data.device ?? null,
      notes: parsed.data.notes ?? null,
    });
    toast.success(`Humedad ${parsed.data.pct}% registrada`);
    setPct(""); setDevice(""); setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar humedad</DialogTitle>
          <DialogDescription>Lote {lot.lot_code}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Humedad (%)</Label>
            <Input type="number" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Dispositivo</Label>
            <Input maxLength={80} value={device} onChange={(e) => setDevice(e.target.value)} placeholder="Ej: Wile 200" />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────── Waste dialog ─────────

const wasteSchema = z.object({
  qty_kg: z.number().positive("Debe ser mayor que cero"),
  reason: z.string().trim().min(2, "Indica un motivo").max(200),
  notes: z.string().trim().max(500).optional(),
});

export function RegisterWasteDialog({ open, onOpenChange, lot }: BaseProps) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const parsed = wasteSchema.safeParse({
      qty_kg: Number(qty),
      reason,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Valor inválido");
      return;
    }
    if (parsed.data.qty_kg > lot.qty_current_kg) {
      toast.error("La merma no puede ser mayor al inventario actual");
      return;
    }
    logWaste({
      lot_id: lot.id,
      qty_kg: parsed.data.qty_kg,
      reason: parsed.data.reason,
      phase_instance_id: lot.current_phase_id,
      notes: parsed.data.notes ?? null,
    });
    toast.success(`Merma de ${parsed.data.qty_kg} kg registrada`);
    setQty(""); setReason(""); setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar merma</DialogTitle>
          <DialogDescription>Lote {lot.lot_code}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cantidad (kg)</Label>
            <Input type="number" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Input maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: Pérdida por secado" />
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleSubmit}>Registrar merma</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
