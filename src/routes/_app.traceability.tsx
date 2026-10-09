import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  GitBranch,
  Search,
  Sprout,
  Package,
  Workflow,
  Beaker,
  Award,
  BookmarkCheck,
  Trash2,
  History,
  ExternalLink,
  Calendar,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useStore } from "@/lib/store";
import { mockDb } from "@/data/mock-data";
import { getStoreSnapshot, getQualitySamples } from "@/lib/store";
import { useFarms } from "@/lib/app-config-store";
import {
  commercialStateLabel,
  commercialStateTone,
  formatKg,
  movementTypeLabel,
  physicalStateLabel,
  qualityStatusLabel,
  qualityTone,
  reservationStatusLabel,
  wasteTypeLabel,
} from "@/lib/helpers";
import type { Lot } from "@/types/domain";

export const Route = createFileRoute("/_app/traceability")({
  head: () => ({
    meta: [
      { title: "Trazabilidad — Bitácora Café Pro" },
      { name: "description", content: "El camino completo de cada lote, desde la cosecha hasta la venta." },
    ],
  }),
  component: TraceabilityPage,
});

function TraceabilityPage() {
  const lots = useStore((s) => s.lots);
  const reservations = useStore((s) => s.reservations);
  const customers = useStore((s) => s.customers);
  const farms = useFarms();

  const [q, setQ] = useState("");
  const [farmId, setFarmId] = useState("all");
  const [variety, setVariety] = useState("all");
  const [processType, setProcessType] = useState("all");
  const [customerId, setCustomerId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const varieties = Array.from(new Set(lots.map((l) => l.variety)));

  const lotIdsWithCustomer = useMemo(() => {
    if (customerId === "all") return null;
    return new Set(reservations.filter((r) => r.customer_id === customerId).map((r) => r.lot_id));
  }, [customerId, reservations]);

  const filtered = useMemo(() => {
    return lots.filter((l) => {
      if (q) {
        const needle = q.toLowerCase();
        const hit =
          l.lot_code.toLowerCase().includes(needle) ||
          l.friendly_name.toLowerCase().includes(needle) ||
          l.variety.toLowerCase().includes(needle);
        if (!hit) return false;
      }
      if (farmId !== "all" && l.farm_id !== farmId) return false;
      if (variety !== "all" && l.variety !== variety) return false;
      if (processType !== "all" && l.process_type !== processType) return false;
      if (lotIdsWithCustomer && !lotIdsWithCustomer.has(l.id)) return false;
      const t = new Date(l.created_at).getTime();
      if (dateFrom && t < new Date(dateFrom).getTime()) return false;
      if (dateTo && t > new Date(dateTo + "T23:59:59").getTime()) return false;
      return true;
    });
  }, [lots, q, farmId, variety, processType, lotIdsWithCustomer, dateFrom, dateTo]);

  const selected = selectedId ? lots.find((l) => l.id === selectedId) ?? null : filtered[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="TRAZABILIDAD" title="Trazabilidad"
        subtitle="Busca cualquier lote y mira su historia completa, paso a paso."
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <div className="col-span-2 md:col-span-2">
              <Label className="text-xs">Buscar (lote, nombre, variedad)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="NAT-2026-001…" className="pl-8" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Finca</Label>
              <Select value={farmId} onValueChange={setFarmId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Variedad</Label>
              <Select value={variety} onValueChange={setVariety}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {varieties.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Proceso</Label>
              <Select value={processType} onValueChange={setProcessType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(["lavado", "honey", "natural", "anaerobico", "experimental", "custom"] as const).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cliente / reserva</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        {/* Results list */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{filtered.length} lotes</p>
          {filtered.length === 0 ? (
            <EmptyState icon={GitBranch} title="Sin resultados" description="Ajusta los filtros para encontrar lotes." />
          ) : (
            filtered.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className={`w-full text-left rounded-lg border p-3 transition hover:border-primary/50 ${
                  selected?.id === l.id ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <p className="font-mono text-xs text-muted-foreground">{l.lot_code}</p>
                <p className="font-medium text-sm">{l.friendly_name}</p>
                <p className="text-xs text-muted-foreground">{l.variety} · {formatKg(l.qty_current_kg)}</p>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        {selected ? <LotTraceabilityDetail lot={selected} /> : (
          <EmptyState icon={GitBranch} title="Selecciona un lote" description="Elige un lote a la izquierda para ver su historia completa." />
        )}
      </div>
    </>
  );
}

function LotTraceabilityDetail({ lot }: { lot: Lot }) {
  const allLots = useStore((s) => s.lots);
  const phases = useStore((s) => s.phases.filter((p) => {
    const pi = mockDb.processInstances.find((i) => i.id === p.process_instance_id);
    return pi?.lot_id === lot.id;
  }));
  const variableLogs = useStore((s) => s.variableLogs.filter((v) => v.lot_id === lot.id));
  const moistureLogs = useStore((s) => s.moistureLogs.filter((m) => m.lot_id === lot.id));
  const wasteLogs = useStore((s) => s.wasteLogs.filter((w) => w.lot_id === lot.id));
  const movements = useStore((s) => s.stockMovements.filter((m) => m.lot_id === lot.id));
  const reservations = useStore((s) => s.reservations.filter((r) => r.lot_id === lot.id));
  const customers = useStore((s) => s.customers);
  const qualitySamples = getQualitySamples().filter((q) => q.lot_id === lot.id);
  const farm = useFarms().find((f) => f.id === lot.farm_id);
  const harvest = getStoreSnapshot().harvestTickets.find((h) => h.id === lot.harvest_ticket_id);

  const parent = lot.parent_lot_id ? allLots.find((l) => l.id === lot.parent_lot_id) : null;
  const children = allLots.filter((l) => l.parent_lot_id === lot.id);

  // Build a unified timeline
  type Event = { at: string; icon: typeof Sprout; title: string; subtitle: string; tone: "info" | "success" | "warning" | "danger" | "neutral" };
  const events: Event[] = [];
  if (harvest) events.push({ at: harvest.harvest_date, icon: Sprout, title: "Cosechado", subtitle: `${harvest.qty_original} ${harvest.uom_original_id}`, tone: "info" });
  events.push({ at: lot.created_at, icon: Package, title: "Lote creado", subtitle: `${lot.lot_code} · ${formatKg(lot.qty_initial_kg)}`, tone: "info" });
  phases.forEach((p) => events.push({ at: p.started_at, icon: Workflow, title: `Fase: ${p.name}`, subtitle: p.status === "finished" ? `Finalizada` : "Iniciada", tone: p.status === "finished" ? "success" : "info" }));
  movements.forEach((m) => events.push({ at: m.created_at, icon: History, title: movementTypeLabel[m.movement_type] ?? m.movement_type, subtitle: `${formatKg(m.qty_kg)}${m.reason ? " · " + m.reason : ""}`, tone: "neutral" }));
  wasteLogs.forEach((w) => events.push({ at: w.registered_at, icon: Trash2, title: `Merma: ${wasteTypeLabel[w.waste_type]}`, subtitle: `${formatKg(w.qty_kg)} → ${w.destination}`, tone: "warning" }));
  qualitySamples.forEach((q) => events.push({ at: q.sampled_at, icon: Award, title: `Calidad: ${q.status}`, subtitle: q.score ? `Score ${q.score}` : "Muestra registrada", tone: "info" }));
  reservations.forEach((r) => {
    const c = customers.find((c) => c.id === r.customer_id);
    events.push({ at: r.reserved_at, icon: BookmarkCheck, title: `Reserva ${reservationStatusLabel[r.status] ?? r.status}`, subtitle: `${c?.name ?? "—"} · ${formatKg(r.qty_kg)}`, tone: "info" });
  });
  events.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{lot.lot_code}</p>
              <CardTitle className="text-xl">{lot.friendly_name}</CardTitle>
              <p className="text-sm text-muted-foreground">{lot.variety} · {farm?.name ?? "—"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/lots/$id" params={{ id: lot.id }} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Ficha completa <ExternalLink className="h-3 w-3" />
              </Link>
              <a href={`/public/lot/${lot.lot_code}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Ficha pública <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <StatusBadge status={commercialStateTone(lot.commercial_state)}>{commercialStateLabel[lot.commercial_state]}</StatusBadge>
          <StatusBadge status={qualityTone(lot.quality_status)}>{qualityStatusLabel[lot.quality_status]}</StatusBadge>
          <StatusBadge status="neutral">{physicalStateLabel[lot.physical_state]}</StatusBadge>
          <StatusBadge status="info">{formatKg(lot.qty_current_kg)} actuales</StatusBadge>
        </CardContent>
      </Card>

      {/* Genealogy */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" /> Genealogía</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {parent ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Lote padre</p>
              <LotChip lot={parent} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Lote original (sin padre).</p>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Lote actual</p>
            <LotChip lot={lot} highlight />
          </div>
          {children.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Lotes hijos ({children.length})</p>
              <div className="space-y-2">{children.map((c) => <LotChip key={c.id} lot={c} />)}</div>
            </div>
          )}
          {wasteLogs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              + {wasteLogs.length} merma(s) y {qualitySamples.length} muestra(s) generadas
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Línea de tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
          ) : (
            <ol className="space-y-3">
              {events.slice(0, 30).map((e, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-7 w-7 rounded-full bg-secondary text-primary flex items-center justify-center">
                      <e.icon className="h-3.5 w-3.5" />
                    </div>
                    {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{e.subtitle}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Sub-sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Movimientos de inventario" icon={History} count={movements.length}>
          <MiniTable rows={movements.slice(0, 8).map((m) => ({
            Fecha: new Date(m.created_at).toLocaleDateString("es"),
            Tipo: movementTypeLabel[m.movement_type] ?? m.movement_type,
            Cantidad: formatKg(m.qty_kg),
            Motivo: m.reason ?? "—",
          }))} />
        </Section>
        <Section title="Historial de proceso" icon={Workflow} count={phases.length}>
          <MiniTable rows={phases.map((p) => ({
            Fase: p.name,
            Inicio: new Date(p.started_at).toLocaleDateString("es"),
            Fin: p.ended_at ? new Date(p.ended_at).toLocaleDateString("es") : "—",
            Estado: p.status,
          }))} />
        </Section>
        <Section title="Variables" icon={Beaker} count={variableLogs.length + moistureLogs.length}>
          <MiniTable rows={[
            ...moistureLogs.slice(0, 5).map((m) => ({ Variable: "Humedad", Valor: `${m.moisture_pct}%`, Fecha: new Date(m.measured_at).toLocaleDateString("es") })),
            ...variableLogs.slice(0, 5).map((v) => ({ Variable: getStoreSnapshot().variableDefinitions.find((d) => d.id === v.variable_id)?.name ?? v.variable_id, Valor: String(v.value_number ?? v.value_text ?? "—"), Fecha: new Date(v.measured_at).toLocaleDateString("es") })),
          ]} />
        </Section>
        <Section title="Calidad" icon={Award} count={qualitySamples.length}>
          <MiniTable rows={qualitySamples.map((q) => ({
            Fecha: new Date(q.sampled_at).toLocaleDateString("es"),
            Catador: q.cupper ?? "—",
            Score: q.score ?? "—",
            Estado: q.status,
          }))} />
        </Section>
        <Section title="Reservas" icon={BookmarkCheck} count={reservations.length}>
          <MiniTable rows={reservations.map((r) => ({
            Cliente: customers.find((c) => c.id === r.customer_id)?.name ?? "—",
            Cantidad: formatKg(r.qty_kg),
            Estado: reservationStatusLabel[r.status] ?? r.status,
            Vence: r.expires_at?.slice(0, 10) ?? "—",
          }))} />
        </Section>
        <Section title="Mermas y rendimiento" icon={Trash2} count={wasteLogs.length}>
          <MiniTable rows={wasteLogs.map((w) => ({
            Fecha: new Date(w.registered_at).toLocaleDateString("es"),
            Tipo: wasteTypeLabel[w.waste_type],
            Cantidad: formatKg(w.qty_kg),
            Destino: w.destination,
          }))} />
          <p className="text-xs text-muted-foreground mt-2">
            Rendimiento actual: {lot.qty_initial_kg > 0 ? Math.round((lot.qty_current_kg / lot.qty_initial_kg) * 100) : 0}%
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: typeof Sprout; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
          <span className="text-xs text-muted-foreground font-normal">({count})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MiniTable({ rows }: { rows: Record<string, React.ReactNode>[] }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground py-2">Sin registros.</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left uppercase text-muted-foreground border-b border-border">
            {cols.map((c) => <th key={c} className="px-2 py-1.5 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              {cols.map((c) => <td key={c} className="px-2 py-1.5">{r[c]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LotChip({ lot, highlight }: { lot: Lot; highlight?: boolean }) {
  return (
    <Link
      to="/lots/$id"
      params={{ id: lot.id }}
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition hover:border-primary/50 ${
        highlight ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="min-w-0">
        <p className="font-mono text-xs text-muted-foreground">{lot.lot_code}</p>
        <p className="font-medium text-sm truncate">{lot.friendly_name}</p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{formatKg(lot.qty_current_kg)}</span>
    </Link>
  );
}
