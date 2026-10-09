import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/ops-cloud";

// SCA sensory attributes (0–10 each) + primary/secondary defects. Validated again by record_quality.
export const SCA_ATTRS: [string, string][] = [
  ["fragancia", "Fragancia/aroma"], ["sabor", "Sabor"], ["postgusto", "Postgusto"], ["acidez", "Acidez"], ["cuerpo", "Cuerpo"],
  ["balance", "Balance"], ["uniformidad", "Uniformidad"], ["taza_limpia", "Taza limpia"], ["dulzor", "Dulzor"], ["general", "General"],
];
export type QualityData = {
  notes?: string; cupping?: string;
  sca?: Record<string, number> | number;
  defects?: { primary?: number; secondary?: number; description?: string } | string;
};

export function qualitySummary(d: QualityData | null | undefined) {
  if (!d) return { defects: "—", sca: "" };
  const def = typeof d.defects === "string" ? d.defects
    : d.defects ? [d.defects.primary != null ? `${d.defects.primary} primarios` : null, d.defects.secondary != null ? `${d.defects.secondary} secundarios` : null, d.defects.description].filter(Boolean).join(", ") : "";
  const sca = d.sca && typeof d.sca === "object" ? SCA_ATTRS.filter(([k]) => (d.sca as Record<string, number>)[k] != null).map(([k, l]) => `${l} ${(d.sca as Record<string, number>)[k]}`).join(" · ") : "";
  return { defects: def || "—", sca };
}

const selectCls = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const okNum = (v: string, max: number) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max);

export function QualityForm({ lots, fixedLot, onSaved }: { lots?: { id: string; label: string }[]; fixedLot?: string; onSaved?: () => void }) {
  const empty = { lot: fixedLot ?? "", status: "aprobado", score: "", primary: "", secondary: "", defectDesc: "", cupping: "", notes: "", sca: {} as Record<string, string> };
  const [f, setF] = useState(empty); const [busy, setBusy] = useState(false);
  const valid = !!(fixedLot ?? f.lot) && okNum(f.score, 100) && okNum(f.primary, 1000) && okNum(f.secondary, 1000)
    && Object.values(f.sca).every((v) => okNum(v, 10));
  return (
    <div className="grid gap-2">
      {!fixedLot && <select className={selectCls} value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })}><option value="">Lote…</option>{(lots ?? []).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>}
      <select className={selectCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
        <option value="aprobado">Aprobado</option><option value="observado">Observado (bloquea venta)</option><option value="rechazado">Rechazado (bloquea venta)</option></select>
      <Input placeholder="Puntaje SCA total (0–100)" inputMode="decimal" value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })} />
      <details className="rounded-md border border-border p-2"><summary className="text-sm cursor-pointer">Atributos sensoriales SCA (0–10)</summary>
        <div className="grid grid-cols-2 gap-2 mt-2">{SCA_ATTRS.map(([k, l]) => (
          <label key={k} className="text-xs grid gap-1">{l}<Input inputMode="decimal" value={f.sca[k] ?? ""} onChange={(e) => setF({ ...f, sca: { ...f.sca, [k]: e.target.value } })} /></label>))}</div>
      </details>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Defectos primarios" inputMode="numeric" value={f.primary} onChange={(e) => setF({ ...f, primary: e.target.value })} />
        <Input placeholder="Defectos secundarios" inputMode="numeric" value={f.secondary} onChange={(e) => setF({ ...f, secondary: e.target.value })} />
      </div>
      <Input placeholder="Descripción de defectos (ej. broca, quebrados)" value={f.defectDesc} onChange={(e) => setF({ ...f, defectDesc: e.target.value })} />
      <Input placeholder="Notas de taza" value={f.cupping} onChange={(e) => setF({ ...f, cupping: e.target.value })} />
      <Textarea rows={2} placeholder="Observaciones" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <Button disabled={busy || !valid} onClick={async () => {
        setBusy(true);
        try {
          const sca = Object.fromEntries(Object.entries(f.sca).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
          const defects = { primary: f.primary === "" ? null : Number(f.primary), secondary: f.secondary === "" ? null : Number(f.secondary), description: f.defectDesc || null };
          const { error } = await supabase.rpc("record_quality", { _lot: fixedLot ?? f.lot, _status: f.status, _score: (f.score === "" ? null : Number(f.score)) as number,
            _data: { sca: Object.keys(sca).length ? sca : null, defects, cupping: f.cupping || null, notes: f.notes || null } });
          if (error) throw error;
          toast.success("Evaluación guardada"); setF(empty); onSaved?.();
        } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
      }}>Guardar evaluación</Button>
    </div>
  );
}
