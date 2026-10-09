import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Kpi, LoadState, LotLink, Section, SimpleTable, qualLabel, selectCls, type Lot } from "@/components/ops-ui";
import { fmtDate, sel, useOrgQuery } from "@/lib/org-data";
import { recordQuality } from "@/lib/ops-cloud";
import { QualityForm, qualitySummary, type QualityData } from "@/components/quality-form";
import { useCurrentRole } from "@/lib/permissions";

export const Route = createFileRoute("/_app/quality")({
  head: () => ({ meta: [
    { title: "Calidad — Bitácora Café Pro" },
    { name: "description", content: "Muestras de calidad con puntaje SCA, humedad, actividad de agua, defectos y notas de taza." },
    { property: "og:title", content: "Calidad — Bitácora Café Pro" },
    { property: "og:description", content: "Evaluaciones de calidad por lote." },
  ] }),
  component: QualityPage,
});

type S = { id: string; lot_id: string; status: string; score: number | null; moisture_pct: number | null; water_activity: number | null; data: QualityData | null; sampled_at: string };

function QualityPage() {
  const role = useCurrentRole(); const can = role === "administrador" || role === "encargado_beneficio";
  const s = useOrgQuery<S[]>("q", (o) => sel("quality_samples", "*", o, "sampled_at"), ["quality_samples"], []);
  const lots = useOrgQuery<Lot[]>("q-l", (o) => sel("lots", "*", o), ["lots"], []);
  const lot = (id: string) => lots.data.find((l) => l.id === id);
  const scored = s.data.filter((x) => x.score != null);
  const avg = scored.length ? (scored.reduce((a, x) => a + Number(x.score), 0) / scored.length).toFixed(1) : "—";
  return (
    <>
      <PageHeader eyebrow="CALIDAD" title="Calidad" subtitle="Aprobar no libera el café: la liberación para la venta se hace aparte, desde la ficha del lote." />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <Kpi label="Muestras" value={s.data.length} /><Kpi label="Puntaje SCA promedio" value={avg} />
        <Kpi label="Aprobadas" value={s.data.filter((x) => x.status === "aprobado").length} />
        <Kpi label="Observadas / rechazadas" value={s.data.filter((x) => x.status === "observado" || x.status === "rechazado" || x.status === "bloqueado").length} tone="warn" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Evaluaciones" className="lg:col-span-2">
          <LoadState loading={s.loading} error={s.error} empty={!s.data.length} emptyText="Aún no hay muestras de calidad." />
          {s.data.length > 0 && <SimpleTable head={["Fecha", "Lote", "Resultado", "SCA", "Defectos", "Notas"]} rows={s.data.map((x) => {
            const l = lot(x.lot_id);
            return [fmtDate(x.sampled_at), l ? <LotLink id={l.id} code={l.lot_code} /> : "—", qualLabel(x.status), x.score ?? "—", qualitySummary(x.data).defects, [qualitySummary(x.data).sca, x.data?.cupping, x.data?.notes].filter(Boolean).join(" · ") || "—"];
          })} />}
        </Section>
        {can && <Section title="Registrar evaluación">
          <div className="grid gap-2">
            <QualityForm lots={lots.data.map((l) => ({ id: l.id, label: `${l.lot_code} · ${l.friendly_name}` }))} />
            <p className="text-xs text-muted-foreground">Observado o rechazado bloquea el café para la venta automáticamente.</p>
          </div>
        </Section>}
      </div>
    </>
  );
}
void recordQuality;
