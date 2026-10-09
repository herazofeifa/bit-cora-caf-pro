import { crDay, inCrRange } from "@/lib/date-range";
import { fmtDay } from "@/lib/org-data";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, Link2, XCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currentGeneration, getOrgId, useCloudState } from "@/lib/cloud";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFarms } from "@/lib/app-config-store";
import { useCurrentRole } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError, publishReportSnapshot, requireOrg, revokeReportSnapshot } from "@/lib/ops-cloud";
import { downloadCsv } from "@/lib/export-csv";
import { reportPdf, type PdfTable } from "@/lib/pdf";
import { groupSum, weightedPriceByCurrency, type RLot, type RRes, type RTicket, type RWaste } from "@/lib/report-data";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [
    { title: "Reportes — Bitácora Café Pro" },
    { name: "description", content: "Producción, inventario, mermas y ventas con datos actuales de la organización; CSV y PDF." },
  ] }),
  component: CloudReports,
});

const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const yearStart = `${crDay().slice(0, 4)}-01-01`;

function CloudReports() {
  const cloud = useCloudState(); const farms = useFarms(); const role = useCurrentRole();
  const [lots, setLots] = useState<RLot[]>([]); const [tickets, setTickets] = useState<RTicket[]>([]);
  const [waste, setWaste] = useState<RWaste[]>([]); const [res, setRes] = useState<RRes[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [shares, setShares] = useState<{ id: string; token: string; title: string; expires_at: string; revoked_at: string | null }[]>([]);
  const [flt, setFlt] = useState({ from: yearStart, to: crDay(), farm: "", variety: "", process: "", customer: "", season: "", commercial: "", quality: "" });
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false); const [shareDays, setShareDays] = useState("7"); const [sharing, setSharing] = useState(false);

  async function load() {
    const org = requireOrg(); const gen = currentGeneration();
    // Late replies from a previous organization/session must never land in this screen.
    const live = () => gen === currentGeneration() && getOrgId() === org;
    setLoading(true);
    try {
      const [l, t, w, r, c, s] = await Promise.all([
        supabase.from("lots").select("id,variety,process_type,farm_id,commercial_state,quality_status,qty_current_kg,qty_free_kg,qty_reserved_kg,qty_committed_kg").eq("organization_id", org),
        supabase.from("harvest_tickets").select("farm_id,variety,harvest_date,qty_kg,season").eq("organization_id", org),
        supabase.from("waste_logs").select("lot_id,waste_type,qty_kg,registered_at").eq("organization_id", org),
        supabase.from("reservations").select("lot_id,customer_id,qty_kg,price,currency,status,delivered_at").eq("organization_id", org),
        supabase.from("customers").select("id,name").eq("organization_id", org),
        supabase.from("report_shares").select("id,token,title,expires_at,revoked_at").eq("organization_id", org).order("created_at", { ascending: false }),
      ]);
      if (!live()) return;
      for (const x of [l, t, w, r, c]) if (x.error) throw x.error;
      setLots((l.data ?? []) as RLot[]); setTickets((t.data ?? []) as RTicket[]); setWaste((w.data ?? []) as RWaste[]);
      setRes((r.data ?? []) as RRes[]); setCustomers(c.data ?? []); setShares(s.data ?? []);
    } catch (e) { if (live()) toast.error(friendlyError(e)); } finally { if (live()) setLoading(false); }
  }
  useEffect(() => {
    // Clear the previous organization's figures immediately on switch/logout.
    setLots([]); setTickets([]); setWaste([]); setRes([]); setCustomers([]); setShares([]);
    if (cloud.orgId) void load();
  }, [cloud.orgId]);

  const d = useMemo(() => {
    const inRange = (iso: string | null) => inCrRange(iso, flt.from, flt.to);
    const lotOk = (l: RLot) => (!flt.farm || l.farm_id === flt.farm) && (!flt.variety || l.variety === flt.variety) && (!flt.process || l.process_type === flt.process)
      && (!flt.commercial || l.commercial_state === flt.commercial) && (!flt.quality || l.quality_status === flt.quality);
    const L = lots.filter(lotOk); const ids = new Set(L.map((l) => l.id));
    const T = tickets.filter((t) => inRange(t.harvest_date) && (!flt.farm || t.farm_id === flt.farm) && (!flt.variety || t.variety === flt.variety) && (!flt.season || t.season === flt.season));
    const W = waste.filter((w) => ids.has(w.lot_id) && inRange(w.registered_at));
    const R = res.filter((r) => ids.has(r.lot_id) && (!flt.customer || r.customer_id === flt.customer));
    const D = R.filter((r) => r.status === "entregada" && inRange(r.delivered_at));
    const farmName = (id: string | null) => farms.find((f) => f.id === id)?.name ?? "Sin finca";
    const custName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
    return {
      harvestByFarm: groupSum(T, (t) => farmName(t.farm_id), (t) => Number(t.qty_kg) || 0),
      harvestByVariety: groupSum(T, (t) => t.variety || "Sin variedad", (t) => Number(t.qty_kg) || 0),
      freeByVariety: groupSum(L, (l) => l.variety || "Sin variedad", (l) => Number(l.qty_free_kg)),
      stockByState: groupSum(L, (l) => l.commercial_state, (l) => Number(l.qty_current_kg)),
      wasteByType: groupSum(W, (w) => w.waste_type, (w) => Number(w.qty_kg)),
      active: R.filter((r) => r.status === "reservada" || r.status === "confirmada").map((r) => ({ cliente: custName(r.customer_id), kg: Number(r.qty_kg), estado: r.status })),
      sales: weightedPriceByCurrency(D),
    };
  }, [lots, tickets, waste, res, flt, farms, customers]);

  const varieties = [...new Set(lots.map((l) => l.variety).filter(Boolean))];
  const seasons = [...new Set(tickets.map((t) => t.season).filter(Boolean))] as string[];
  const filterLabels = {
    Desde: flt.from, Hasta: flt.to, Finca: farms.find((f) => f.id === flt.farm)?.name ?? "", Variedad: flt.variety, Proceso: flt.process,
    Temporada: flt.season, Cliente: customers.find((c) => c.id === flt.customer)?.name ?? "", "Estado comercial": flt.commercial, Calidad: flt.quality,
  };
  const tables: PdfTable[] = [
    { title: "Cosecha por finca (kg)", head: ["Finca", "kg"], rows: d.harvestByFarm.map((x) => [x.key, x.kg]) },
    { title: "Cosecha por variedad (kg)", head: ["Variedad", "kg"], rows: d.harvestByVariety.map((x) => [x.key, x.kg]) },
    { title: "Café libre por variedad (kg)", head: ["Variedad", "kg libres"], rows: d.freeByVariety.map((x) => [x.key, x.kg]) },
    { title: "Inventario por estado comercial (kg)", head: ["Estado", "kg"], rows: d.stockByState.map((x) => [x.key, x.kg]) },
    { title: "Mermas por tipo (kg)", head: ["Tipo", "kg"], rows: d.wasteByType.map((x) => [x.key, x.kg]) },
    { title: "Reservas activas", head: ["Cliente", "kg", "Estado"], rows: d.active.map((x) => [x.cliente, x.kg, x.estado]) },
    { title: "Ventas entregadas: precio promedio ponderado por kg", head: ["Moneda", "Entregas", "kg entregados", "Precio ponderado / kg"],
      rows: d.sales.map((x) => [x.currency, x.deliveries, x.kg, x.weighted_price_per_kg ?? "—"]) },
  ];
  const csv = () => downloadCsv(`reporte-${flt.from}-${flt.to}.csv`, tables.flatMap((t) => t.rows.map((r) => ({ seccion: t.title, ...Object.fromEntries(t.head.map((h, i) => [h, r[i]])) }))));
  async function share() {
    const days = Math.round(Number(shareDays));
    if (!(days >= 1 && days <= 90)) { toast.error("Elige entre 1 y 90 días."); return; }
    setSharing(true);
    try {
      const safe = tables.filter((t) => t.title !== "Reservas activas");
      const s = await publishReportSnapshot(`Resumen ${flt.from} a ${flt.to}`, { filters: filterLabels, tables: safe }, days);
      const url = `${window.location.origin}/r/${s.token}`;
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Enlace público creado y copiado"); setShareOpen(false); void load();
    } catch (e) { toast.error(friendlyError(e)); } finally { setSharing(false); }
  }

  if (!cloud.orgId) return <p className="text-muted-foreground">Cargando…</p>;
  const F = (k: keyof typeof flt) => (e: { target: { value: string } }) => setFlt({ ...flt, [k]: e.target.value });

  return (
    <>
      <PageHeader eyebrow="REPORTES" title="Reportes" subtitle="Datos actuales de la organización. Las cantidades están en kg; los precios, por kg en su moneda."
        action={<div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={csv}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <Button onClick={() => void reportPdf("Reporte de operación", filterLabels, tables, `reporte-${flt.from}-${flt.to}.pdf`)}><FileText className="h-4 w-4 mr-1" />PDF</Button>
          {(role === "administrador" || role === "comercial") && <Button variant="outline" onClick={() => setShareOpen(true)}><Link2 className="h-4 w-4 mr-1" />Compartir</Button>}
        </div>} />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mb-6 rounded-xl border border-border bg-card p-4">
        <div><Label>Desde</Label><Input type="date" value={flt.from} onChange={F("from")} /></div>
        <div><Label>Hasta</Label><Input type="date" value={flt.to} onChange={F("to")} /></div>
        <div><Label>Finca</Label><select className={sel} value={flt.farm} onChange={F("farm")}><option value="">Todas</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div><Label>Variedad</Label><select className={sel} value={flt.variety} onChange={F("variety")}><option value="">Todas</option>{varieties.map((v) => <option key={v}>{v}</option>)}</select></div>
        <div><Label>Proceso</Label><select className={sel} value={flt.process} onChange={F("process")}><option value="">Todos</option>{["lavado", "honey", "natural", "anaerobico"].map((v) => <option key={v}>{v}</option>)}</select></div>
        <div><Label>Temporada</Label><select className={sel} value={flt.season} onChange={F("season")}><option value="">Todas</option>{seasons.map((v) => <option key={v}>{v}</option>)}</select></div>
        <div><Label>Cliente</Label><select className={sel} value={flt.customer} onChange={F("customer")}><option value="">Todos</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><Label>Estado comercial</Label><select className={sel} value={flt.commercial} onChange={F("commercial")}><option value="">Todos</option>{["en_proceso", "disponible", "reservado", "comprometido", "vendido_parcial", "vendido", "bloqueado_calidad"].map((v) => <option key={v}>{v}</option>)}</select></div>
        <div><Label>Calidad</Label><select className={sel} value={flt.quality} onChange={F("quality")}><option value="">Todas</option>{["sin_evaluar", "aprobado", "observado", "rechazado"].map((v) => <option key={v}>{v}</option>)}</select></div>
      </div>
      {loading ? <p className="text-muted-foreground">Cargando datos…</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {tables.map((t) => (
            <section key={t.title} className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-serif text-lg mb-2">{t.title}</h2>
              {t.rows.length === 0 ? <p className="text-sm text-muted-foreground">Sin registros para estos filtros.</p> :
                t.head.length === 2 ? (
                  <div className="h-48"><ResponsiveContainer><BarChart data={t.rows.map((r) => ({ k: r[0], v: r[1] }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="k" fontSize={11} /><YAxis fontSize={11} /><Tooltip />
                    <Bar dataKey="v" fill="var(--color-primary)" radius={4} /></BarChart></ResponsiveContainer></div>
                ) : (
                  <table className="w-full text-sm"><thead><tr>{t.head.map((h) => <th key={h} className="text-left font-medium py-1">{h}</th>)}</tr></thead>
                    <tbody>{t.rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="py-1">{c}</td>)}</tr>)}</tbody></table>
                )}
            </section>))}
        </div>)}
      {shares.length > 0 && (
        <section className="mt-6 rounded-xl border border-border p-4 text-sm">
          <h2 className="font-serif text-lg mb-2">Enlaces compartidos</h2>
          <ul className="space-y-1">{shares.map((s) => {
            const live = !s.revoked_at && new Date(s.expires_at) > new Date();
            return <li key={s.id} className="flex items-center justify-between gap-2">
              <span>{s.title} · {live ? `vence ${fmtDay(s.expires_at)}` : "inactivo"} {live && <Link to="/r/$token" params={{ token: s.token }} className="underline ml-1">abrir</Link>}</span>
              {live && <Button size="sm" variant="ghost" onClick={async () => { try { await revokeReportSnapshot(s.id); void load(); } catch (e) { toast.error(friendlyError(e)); } }}><XCircle className="h-4 w-4 mr-1" />Revocar</Button>}
            </li>; })}</ul>
        </section>)}
      <Dialog open={shareOpen} onOpenChange={(o) => { if (!sharing) setShareOpen(o); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Compartir copia pública del reporte</DialogTitle>
            <DialogDescription>Se guarda una copia fija de los totales de este periodo ({flt.from} a {flt.to}). Cualquiera con el enlace podrá verla hasta que venza o la revoques.</DialogDescription></DialogHeader>
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>Incluye: producción, inventario, procesos, mermas, calidad y ventas entregadas por moneda.</li>
            <li>No incluye: clientes, reservas activas ni datos personales.</li>
          </ul>
          <div className="grid gap-1"><Label htmlFor="share-days">Días disponible (1–90)</Label>
            <Input id="share-days" type="number" min={1} max={90} value={shareDays} onChange={(e) => setShareDays(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" disabled={sharing} onClick={() => setShareOpen(false)}>Cancelar</Button>
            <Button disabled={sharing} onClick={() => void share()}>Crear enlace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
