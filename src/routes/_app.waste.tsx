import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bars, Kpi, LoadState, Section, SimpleTable, selectCls, type Lot } from "@/components/ops-ui";
import { fmtDate, fmtKg, sel, useOrgQuery } from "@/lib/org-data";
import { friendlyError, logWaste } from "@/lib/ops-cloud";
import { groupSum } from "@/lib/report-data";
import { useCurrentRole } from "@/lib/permissions";

export const Route = createFileRoute("/_app/waste")({
  head: () => ({ meta: [
    { title: "Mermas — Bitácora Café Pro" },
    { name: "description", content: "Mermas de proceso por diferencia de peso y descartes registrados con motivo y destino." },
    { property: "og:title", content: "Mermas — Bitácora Café Pro" },
    { property: "og:description", content: "Mermas y descartes por lote." },
  ] }),
  component: WastePage,
});

type W = { id: string; lot_id: string; waste_type: string; destination: string; qty_kg: number; reason: string; registered_at: string };
const TYPES = ["pulpa", "flotes", "broca", "humedad", "pasilla", "derrame", "otro"];

function WastePage() {
  const role = useCurrentRole(); const can = role === "administrador" || role === "encargado_beneficio";
  const w = useOrgQuery<W[]>("waste", (o) => sel("waste_logs", "*", o, "registered_at"), ["waste_logs"], []);
  const lots = useOrgQuery<Lot[]>("w-l", (o) => sel("lots", "*", o), ["lots"], []);
  const [f, setF] = useState({ lot: "", qty: "", type: "pulpa", reason: "", dest: "compost" }); const [busy, setBusy] = useState(false);
  const code = (id: string) => lots.data.find((l) => l.id === id)?.lot_code ?? "—";
  const lot = lots.data.find((l) => l.id === f.lot);
  const total = w.data.reduce((a, x) => a + Number(x.qty_kg), 0);
  const process = w.data.filter((x) => x.waste_type === "proceso").reduce((a, x) => a + Number(x.qty_kg), 0);
  return (
    <>
      <PageHeader eyebrow="MERMAS" title="Mermas" subtitle="Las mermas por diferencia de peso se registran solas al cerrar una fase. Aquí también registras descartes." />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 mb-6"><Kpi label="Total" value={fmtKg(total)} /><Kpi label="Por proceso (peso)" value={fmtKg(process)} /><Kpi label="Registros" value={w.data.length} /></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Por tipo"><Bars data={groupSum(w.data, (x) => x.waste_type, (x) => Number(x.qty_kg))} /></Section>
        <Section title="Historial" className="lg:col-span-2">
          <LoadState loading={w.loading} error={w.error} empty={!w.data.length} emptyText="Sin mermas registradas." />
          {w.data.length > 0 && <SimpleTable head={["Fecha", "Lote", "Tipo", "Kg", "Motivo", "Destino"]} rows={w.data.map((x) => [fmtDate(x.registered_at), code(x.lot_id), x.waste_type, fmtKg(x.qty_kg), x.reason, x.destination])} />}
        </Section>
        {can && <Section title="Registrar merma o descarte">
          <div className="grid gap-2">
            <select className={selectCls} value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })}><option value="">Lote…</option>{lots.data.filter((l) => l.qty_current_kg > 0).map((l) => <option key={l.id} value={l.id}>{l.lot_code} · {fmtKg(l.qty_current_kg)}</option>)}</select>
            <Input inputMode="decimal" placeholder="Kg" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
            <select className={selectCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <Input placeholder="Motivo" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
            <select className={selectCls} value={f.dest} onChange={(e) => setF({ ...f, dest: e.target.value })}>{["compost", "venta_subproducto", "descarte", "reproceso"].map((t) => <option key={t}>{t}</option>)}</select>
            {lot && Number(f.qty) > 0 && <p className="text-xs text-muted-foreground">El lote quedará con {fmtKg(lot.qty_current_kg - Number(f.qty))}.</p>}
            <Button disabled={busy || !f.lot || !(Number(f.qty) > 0) || !f.reason.trim()} onClick={async () => {
              setBusy(true); try { await logWaste(f.lot, Number(f.qty), f.type, f.reason, f.dest); toast.success("Merma registrada"); setF({ ...f, qty: "", reason: "" }); } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
            }}>Registrar</Button>
          </div>
        </Section>}
      </div>
    </>
  );
}
