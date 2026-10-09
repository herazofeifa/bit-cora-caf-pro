import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadState, LotLink, Section, SimpleTable, selectCls, type Lot } from "@/components/ops-ui";
import { DEFAULT_ORG_SETTINGS, fmtDate, loadOrgSettings, sel, useOrgQuery } from "@/lib/org-data";
import { friendlyError, logMoisture, logPhaseVariable, newOpKey } from "@/lib/ops-cloud";
import { useCurrentRole } from "@/lib/permissions";

type Search = { tab?: string };
export const Route = createFileRoute("/_app/variables")({
  validateSearch: (s: Record<string, unknown>): Search => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  head: () => ({ meta: [
    { title: "Variables y humedad — Bitácora Café Pro" },
    { name: "description", content: "Registra humedad y variables de proceso (temperatura, pH, Brix) con rangos y su historial." },
    { property: "og:title", content: "Variables y humedad — Bitácora Café Pro" },
    { property: "og:description", content: "Mediciones de proceso y humedad." },
  ] }),
  component: VariablesPage,
});

type VL = { id: string; lot_id: string; phase_id: string | null; value_number: number | null; value: { label?: string; unit?: string; in_range?: boolean } | null; measured_at: string };
type ML = { id: string; lot_id: string; moisture_pct: number; measured_at: string; device: string | null; notes: string | null };
type Ph = { id: string; lot_id: string; name: string; status: string; variables: { key: string; label?: string; unit?: string; min?: number; max?: number }[] };

function VariablesPage() {
  const role = useCurrentRole(); const can = role === "administrador" || role === "encargado_beneficio";
  const vl = useOrgQuery<VL[]>("vl", (o) => sel("variable_logs", "id,lot_id,phase_id,value_number,value,measured_at", o, "measured_at", false, 300), ["variable_logs"], []);
  const ml = useOrgQuery<ML[]>("ml", (o) => sel("moisture_logs", "*", o, "measured_at", false, 300), ["moisture_logs"], []);
  const lots = useOrgQuery<Lot[]>("v-l", (o) => sel("lots", "*", o), ["lots"], []);
  const ph = useOrgQuery<Ph[]>("v-ph", async (o) => (await sel<Ph[]>("process_phases", "id,lot_id,name,status,variables", o, "started_at")).filter((p) => p.status !== "finished"), ["process_phases"], []);
  const st = useOrgQuery("v-st", loadOrgSettings, ["org_settings"], DEFAULT_ORG_SETTINGS);
  const [m, setM] = useState({ lot: "", pct: "", device: "" }); const [v, setV] = useState({ phase: "", key: "", value: "" }); const [busy, setBusy] = useState(false);
  const code = (id: string) => lots.data.find((l) => l.id === id)?.lot_code ?? "—";
  const phase = ph.data.find((p) => p.id === v.phase);
  const vars = phase?.variables.length ? phase.variables : [{ key: "temperatura", label: "Temperatura", unit: "°C" }, { key: "ph", label: "pH" }, { key: "brix", label: "Brix", unit: "°Bx" }];
  const { moisture_min: lo, moisture_max: hi } = st.data;
  const pct = Number(m.pct);
  const hint = m.pct && pct > 0 ? (pct > hi ? `Sigue en secado. Faltan aproximadamente ${(pct - hi).toFixed(1)} puntos para llegar al rango ideal (${lo}–${hi}%).` : pct < lo ? `Por debajo del mínimo (${lo}%): se creará una alerta.` : "Dentro del rango ideal.") : "";
  const run = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); try { await fn(); toast.success(ok); } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); } };

  return (
    <>
      <PageHeader eyebrow="VARIABLES" title="Variables y humedad" subtitle={`Rango de humedad de la organización: ${lo}–${hi}%. Se cambia en Ajustes.`} />
      {can && <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Section title="Registrar humedad">
          <div className="grid gap-2">
            <select className={selectCls} value={m.lot} onChange={(e) => setM({ ...m, lot: e.target.value })}><option value="">Lote…</option>{lots.data.filter((l) => l.qty_current_kg > 0).map((l) => <option key={l.id} value={l.id}>{l.lot_code} · {l.friendly_name}</option>)}</select>
            <Input placeholder="Humedad %" inputMode="decimal" value={m.pct} onChange={(e) => setM({ ...m, pct: e.target.value })} />
            <Input placeholder="Equipo (opcional)" value={m.device} onChange={(e) => setM({ ...m, device: e.target.value })} />
            {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
            <Button disabled={busy || !m.lot || !(pct > 0 && pct <= 100)} onClick={() => run(async () => { await logMoisture(m.lot, pct, m.device || null, null); setM({ ...m, pct: "" }); }, `Humedad registrada. ${hint}`)}>Registrar humedad</Button>
          </div>
        </Section>
        <Section title="Registrar variable de una fase en curso">
          <div className="grid gap-2">
            <select className={selectCls} value={v.phase} onChange={(e) => setV({ ...v, phase: e.target.value, key: "" })}><option value="">Fase en curso…</option>{ph.data.map((p) => <option key={p.id} value={p.id}>{code(p.lot_id)} · {p.name}</option>)}</select>
            <select className={selectCls} value={v.key} onChange={(e) => setV({ ...v, key: e.target.value })} disabled={!phase}><option value="">Variable…</option>{vars.map((x) => <option key={x.key} value={x.key}>{x.label ?? x.key}{"min" in x && x.min != null ? ` (${x.min}–${x.max})` : ""}</option>)}</select>
            <Input placeholder="Valor" inputMode="decimal" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} />
            <Button disabled={busy || !v.phase || !v.key || v.value === "" || !Number.isFinite(Number(v.value))} onClick={() => run(async () => { await logPhaseVariable(v.phase, v.key, Number(v.value), null, newOpKey("var")); setV({ ...v, value: "" }); }, "Medición registrada")}>Registrar</Button>
            {ph.data.length === 0 && <p className="text-xs text-muted-foreground">No hay fases en curso. Inicia una desde la ficha del lote.</p>}
          </div>
        </Section>
      </div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Historial de humedad">
          <LoadState loading={ml.loading} error={ml.error} empty={!ml.data.length} />
          {ml.data.length > 0 && <SimpleTable head={["Fecha", "Lote", "%", "Equipo"]} rows={ml.data.map((x) => [fmtDate(x.measured_at), <LotLink id={x.lot_id} code={code(x.lot_id)} />,
            <span className={x.moisture_pct < lo ? "text-destructive" : ""}>{x.moisture_pct}%</span>, x.device ?? "—"])} />}
        </Section>
        <Section title="Historial de variables">
          <LoadState loading={vl.loading} error={vl.error} empty={!vl.data.length} />
          {vl.data.length > 0 && <SimpleTable head={["Fecha", "Lote", "Variable", "Valor"]} rows={vl.data.map((x) => [fmtDate(x.measured_at), <LotLink id={x.lot_id} code={code(x.lot_id)} />, x.value?.label ?? "—",
            <span className={x.value?.in_range === false ? "text-destructive" : ""}>{x.value_number} {x.value?.unit ?? ""}{x.value?.in_range === false ? " (fuera de rango)" : ""}</span>])} />}
        </Section>
      </div>
    </>
  );
}
