import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Bars, Kpi, LoadState, LotLink, Section, SimpleTable, physLabel, qualLabel, type Lot } from "@/components/ops-ui";
import { fmtKg, sel, useOrgQuery } from "@/lib/org-data";
import { groupSum } from "@/lib/report-data";

export const Route = createFileRoute("/_app/free-coffee")({
  head: () => ({ meta: [
    { title: "Café libre — Bitácora Café Pro" },
    { name: "description", content: "Café liberado para la venta y todavía sin reservar, por lote, variedad y proceso." },
    { property: "og:title", content: "Café libre — Bitácora Café Pro" },
    { property: "og:description", content: "Kilos disponibles para vender." },
  ] }),
  component: FreeCoffee,
});

function FreeCoffee() {
  const lots = useOrgQuery<Lot[]>("free", (o) => sel("lots", "*", o), ["lots"], []);
  const L = lots.data.filter((l) => l.sale_released && Number(l.qty_free_kg) > 0);
  const total = L.reduce((a, l) => a + Number(l.qty_free_kg), 0);
  return (
    <>
      <PageHeader eyebrow="CAFÉ LIBRE" title="Café libre para vender" subtitle="Solo aparece café liberado para la venta, sin reservas ni bloqueos." />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 mb-6"><Kpi label="Total libre" value={fmtKg(total)} /><Kpi label="Lotes" value={L.length} /></div>
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Section title="Por variedad"><Bars data={groupSum(L, (l) => l.variety || "—", (l) => Number(l.qty_free_kg))} /></Section>
        <Section title="Por proceso"><Bars data={groupSum(L, (l) => l.process_type, (l) => Number(l.qty_free_kg))} /></Section>
      </div>
      <Section title="Lotes con café libre">
        <LoadState loading={lots.loading} error={lots.error} empty={!L.length} emptyText="No hay café libre ahora. Libera un lote desde su ficha cuando esté listo." />
        {L.length > 0 && <SimpleTable head={["Lote", "Variedad", "Proceso", "Estado", "Calidad", "Libre", ""]} rows={L.map((l) => [
          <LotLink id={l.id} code={l.lot_code} />, l.variety || "—", l.process_type, physLabel(l.physical_state), qualLabel(l.quality_status), fmtKg(l.qty_free_kg),
          <Button asChild size="sm"><Link to="/reservations" search={{ lot: l.id }}>Reservar</Link></Button>])} />}
      </Section>
    </>
  );
}
