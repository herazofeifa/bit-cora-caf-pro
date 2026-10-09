import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadState, LotLink, Section, SimpleTable } from "@/components/ops-ui";
import { fmtDate, fmtKg, sel, useOrgQuery } from "@/lib/org-data";
import { downloadCsv } from "@/lib/export-csv";

export const Route = createFileRoute("/_app/intake")({
  head: () => ({ meta: [
    { title: "Recibos de cosecha — Bitácora Café Pro" },
    { name: "description", content: "Recibos de café recibido: unidad original, conversión a kg, finca, jornada y lote creado." },
    { property: "og:title", content: "Recibos de cosecha — Bitácora Café Pro" },
    { property: "og:description", content: "Recibos con conversión a kg y lote asociado." },
  ] }),
  component: IntakePage,
});

type T = { id: string; harvest_date: string; intake_datetime: string; farm_id: string; parcel_id: string | null; variety: string | null; qty_original: number; uom_original: string;
  qty_kg: number | null; conversion_factor_to_kg: number | null; conversion_basis: string; season: string | null; cut_type: string | null; worker_count: number | null; responsible: string | null; lot_id: string | null; producer_name: string | null };

function IntakePage() {
  const tk = useOrgQuery<T[]>("intake", (o) => sel("harvest_tickets", "*", o, "intake_datetime"), ["harvest_tickets"], []);
  const farms = useOrgQuery<{ id: string; name: string }[]>("i-f", (o) => sel("farms", "id,name", o, "name", true), ["farms"], []);
  const lots = useOrgQuery<{ id: string; lot_code: string }[]>("i-l", (o) => sel("lots", "id,lot_code", o), ["lots"], []);
  const [q, setQ] = useState("");
  const farm = (id: string) => farms.data.find((f) => f.id === id)?.name ?? "—";
  const rows = tk.data.filter((t) => !q || `${farm(t.farm_id)} ${t.variety} ${t.season} ${t.responsible}`.toLowerCase().includes(q.toLowerCase()));
  const total = rows.reduce((a, t) => a + Number(t.qty_kg ?? 0), 0);
  return (
    <>
      <PageHeader eyebrow="RECIBOS" title="Recibos de cosecha" subtitle="Cada entrega de café con la unidad en que se midió y su equivalente en kilos."
        action={<Button asChild><Link to="/harvest"><Plus className="h-4 w-4 mr-1" />Registrar cosecha</Link></Button>} />
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="max-w-xs" placeholder="Buscar finca, variedad, temporada…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={() => downloadCsv("recibos.csv", rows.map((t) => ({ fecha: t.harvest_date, finca: farm(t.farm_id), variedad: t.variety ?? "", cantidad: t.qty_original, unidad: t.uom_original, factor_kg: t.conversion_factor_to_kg ?? "", kg: t.qty_kg ?? "", temporada: t.season ?? "", responsable: t.responsible ?? "" })))}>CSV</Button>
      </div>
      <Section title={`${rows.length} recibos · ${fmtKg(total)}`}>
        <LoadState loading={tk.loading} error={tk.error} empty={!rows.length} emptyText="Aún no hay recibos. Se crean al registrar una cosecha." />
        {rows.length > 0 && <SimpleTable head={["Recibido", "Finca", "Variedad", "Medido", "Conversión", "Kg", "Jornada", "Lote"]} rows={rows.map((t) => {
          const lot = lots.data.find((l) => l.id === t.lot_id);
          return [fmtDate(t.intake_datetime), farm(t.farm_id), t.variety ?? "—", `${t.qty_original} ${t.uom_original}`,
            t.conversion_factor_to_kg ? `× ${t.conversion_factor_to_kg} (${t.conversion_basis})` : t.conversion_basis, fmtKg(t.qty_kg),
            [t.season, t.cut_type, t.worker_count ? `${t.worker_count} recolectores` : null, t.responsible].filter(Boolean).join(" · ") || "—",
            lot ? <LotLink id={lot.id} code={lot.lot_code} /> : "—"];
        })} />}
      </Section>
    </>
  );
}
