import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Kpi, LoadState, LotLink, Section, SimpleTable } from "@/components/ops-ui";
import { fmtDate, fmtKg, sel, useOrgQuery } from "@/lib/org-data";
import { overduePhases } from "@/lib/ops-cloud";

type Search = { tab?: string };
export const Route = createFileRoute("/_app/processes")({
  validateSearch: (s: Record<string, unknown>): Search => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  head: () => ({ meta: [
    { title: "Procesos — Bitácora Café Pro" },
    { name: "description", content: "Fases en curso y terminadas, atrasos, rendimientos por peso y plantillas de proceso con versiones." },
    { property: "og:title", content: "Procesos — Bitácora Café Pro" },
    { property: "og:description", content: "Control de fases y plantillas de proceso." },
  ] }),
  component: ProcessesPage,
});

type P = { id: string; lot_id: string; name: string; status: string; started_at: string; ended_at: string | null; weight_in_kg: number | null; weight_out_kg: number | null; expected_minutes: number | null };
type T = { id: string; name: string; process_type: string; version: number; is_custom: boolean; active: boolean; phases: { name: string }[] };

function ProcessesPage() {
  const { tab } = Route.useSearch();
  const ph = useOrgQuery<P[]>("ph", (o) => sel("process_phases", "*", o, "started_at"), ["process_phases"], []);
  const lots = useOrgQuery<{ id: string; lot_code: string }[]>("ph-l", (o) => sel("lots", "id,lot_code", o), ["lots"], []);
  const tpl = useOrgQuery<T[]>("tpl", (o) => sel("process_templates", "*", o, "name", true), ["process_templates"], []);
  const ov = useOrgQuery("ph-ov", () => overduePhases(), ["process_phases"], [] as Awaited<ReturnType<typeof overduePhases>>);
  const code = (id: string) => lots.data.find((l) => l.id === id)?.lot_code ?? "—";
  const running = ph.data.filter((p) => p.status !== "finished"); const done = ph.data.filter((p) => p.status === "finished");
  const yieldPct = (p: P) => (p.weight_in_kg && p.weight_out_kg != null ? `${((p.weight_out_kg / p.weight_in_kg) * 100).toFixed(1)}%` : "—");
  return (
    <>
      <PageHeader eyebrow="PROCESOS" title="Procesos" subtitle="Inicia, mide y cierra fases desde la ficha de cada lote. Aquí ves el panorama y las plantillas."
        action={<Button asChild><Link to="/processes/custom-builder">Editor de plantillas</Link></Button>} />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <Kpi label="Fases en curso" value={running.length} /><Kpi label="Atrasadas" value={ov.data.length} tone={ov.data.length ? "warn" : undefined} />
        <Kpi label="Terminadas" value={done.length} /><Kpi label="Plantillas activas" value={tpl.data.filter((t) => t.active).length} />
      </div>
      <div className="grid gap-4">
        <Section title={tab === "activos" ? "Control de proceso: fases en curso" : "Fases en curso"}>
          <LoadState loading={ph.loading} error={ph.error} empty={!running.length} emptyText="No hay fases en curso." />
          {running.length > 0 && <SimpleTable head={["Lote", "Fase", "Inicio", "Entra", "Estado"]} rows={running.map((p) => {
            const o = ov.data.find((x) => x.phase_id === p.id);
            return [<LotLink id={p.lot_id} code={code(p.lot_id)} />, p.name, fmtDate(p.started_at), fmtKg(p.weight_in_kg), o ? <span className="text-destructive">Atrasada · {o.reason}</span> : "En tiempo"];
          })} />}
        </Section>
        <Section title="Fases terminadas y rendimiento">
          <LoadState loading={ph.loading} error={null} empty={!done.length} emptyText="Aún no hay fases cerradas." />
          {done.length > 0 && <SimpleTable head={["Lote", "Fase", "Cierre", "Entra", "Sale", "Rendimiento"]} rows={done.slice(0, 80).map((p) => [
            <LotLink id={p.lot_id} code={code(p.lot_id)} />, p.name, fmtDate(p.ended_at), fmtKg(p.weight_in_kg), fmtKg(p.weight_out_kg), yieldPct(p)])} />}
        </Section>
        <Section title="Plantillas">
          <LoadState loading={tpl.loading} error={tpl.error} empty={!tpl.data.length} />
          {tpl.data.length > 0 && <SimpleTable head={["Nombre", "Tipo", "Versión", "Fases", "Estado"]} rows={tpl.data.map((t) => [
            t.name, t.process_type, `v${t.version}${t.is_custom ? " · personalizada" : ""}`, t.phases.map((p) => p.name).join(" → "), t.active ? "Activa" : "Versión anterior"])} />}
        </Section>
      </div>
    </>
  );
}
