import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  FileText,
  Share2,
  AlertTriangle,
  Sprout,
  Warehouse,
  Workflow,
  Gauge,
  Trash2,
  Award,
  BookmarkCheck,
  Bell,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useStore } from "@/lib/store";
import { mockDb } from "@/data/mock-data";
import { useFarms, useParcels } from "@/lib/app-config-store";
import {
  calcAvailableKg,
  commercialStateLabel,
  commercialStateTone,
  formatKg,
  phaseDurationDays,
  phaseDurationHours,
  physicalStateLabel,
  physicalStateTone,
  qualityStatusLabel,
  qualityTone,
  reservationStatusLabel,
  wasteTypeLabel,
} from "@/lib/helpers";
import type { CommercialState, PhysicalState, QualityStatus } from "@/types/domain";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reportes — Bitácora Café Pro" },
      { name: "description", content: "Reportes de producción, inventario, procesos, rendimientos, mermas, calidad y reservas." },
    ],
  }),
  component: ReportsPage,
});

// ───────────── Helpers ─────────────

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--accent-foreground))",
];

function harvestSeasonOf(dateIso: string | null | undefined): string {
  if (!dateIso) return "Sin temporada";
  const d = new Date(dateIso);
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  // Cosecha CR: oct (año X) → mar (año X+1)
  if (m >= 10) return `${y}/${y + 1}`;
  if (m <= 3) return `${y - 1}/${y}`;
  return `Mitaca ${y}`;
}

function processTypeLabel(t: string): string {
  return ({ lavado: "Lavado", honey: "Honey", natural: "Natural", anaerobico: "Anaeróbico", experimental: "Experimental", custom: "Personalizado" } as Record<string, string>)[t] ?? t;
}

interface ChartCardProps {
  title: string;
  question?: string;
  children: React.ReactNode;
  empty?: boolean;
  emptyMsg?: string;
}
function ReportCard({ title, question, children, empty, emptyMsg }: ChartCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {question && <CardDescription className="text-xs italic">“{question}”</CardDescription>}
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {emptyMsg ?? "Aún no hay datos para mostrar."}
          </p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function SimpleBar({ data, dataKey = "value", nameKey = "name", height = 220, color = CHART_COLORS[0], unit = "" }: {
  data: { name: string; value: number }[]; dataKey?: string; nameKey?: string; height?: number; color?: string; unit?: string;
}) {
  if (!data.length) return <p className="text-sm text-muted-foreground py-6 text-center">Sin datos.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <RTooltip formatter={(v: number) => `${v.toLocaleString("es")}${unit ? " " + unit : ""}`} />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SimpleDonut({ data, height = 220 }: { data: { name: string; value: number }[]; height?: number }) {
  if (!data.length || data.every((d) => !d.value)) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Sin datos.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <RTooltip formatter={(v: number) => `${Number(v).toLocaleString("es")} kg`} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ───────────── Filters ─────────────

interface Filters {
  from: string;
  to: string;
  season: string;
  farmId: string;
  parcelId: string;
  variety: string;
  processType: string;
  physicalState: string;
  commercialState: string;
  customerId: string;
  qualityStatus: string;
}

const EMPTY_FILTERS: Filters = {
  from: "",
  to: "",
  season: "all",
  farmId: "all",
  parcelId: "all",
  variety: "all",
  processType: "all",
  physicalState: "all",
  commercialState: "all",
  customerId: "all",
  qualityStatus: "all",
};

function FiltersBar({ filters, setFilters, onClear }: { filters: Filters; setFilters: (f: Filters) => void; onClear: () => void }) {
  const farms = useFarms();
  const parcels = useParcels().filter((p) => filters.farmId === "all" || p.farm_id === filters.farmId);
  const varieties = Array.from(new Set(mockDb.lots.map((l) => l.variety).filter(Boolean)));
  const customers = mockDb.customers;
  const seasons = Array.from(new Set(mockDb.harvestTickets.map((h) => harvestSeasonOf(h.harvest_date))));

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters({ ...filters, [k]: v });

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Temporada</Label>
            <Select value={filters.season} onValueChange={(v) => set("season", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {seasons.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Finca</Label>
            <Select value={filters.farmId} onValueChange={(v) => set("farmId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Parcela</Label>
            <Select value={filters.parcelId} onValueChange={(v) => set("parcelId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {parcels.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Variedad</Label>
            <Select value={filters.variety} onValueChange={(v) => set("variety", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {varieties.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Proceso</Label>
            <Select value={filters.processType} onValueChange={(v) => set("processType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(["lavado", "honey", "natural", "anaerobico", "experimental", "custom"] as const).map((p) => (
                  <SelectItem key={p} value={p}>{processTypeLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Estado físico</Label>
            <Select value={filters.physicalState} onValueChange={(v) => set("physicalState", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(physicalStateLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Estado comercial</Label>
            <Select value={filters.commercialState} onValueChange={(v) => set("commercialState", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(commercialStateLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={filters.customerId} onValueChange={(v) => set("customerId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Calidad</Label>
            <Select value={filters.qualityStatus} onValueChange={(v) => set("qualityStatus", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(qualityStatusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" size="sm" className="w-full" onClick={onClear}>Limpiar filtros</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExportBar() {
  const placeholder = (kind: string) => () => toast.info(`${kind}: disponible próximamente.`);
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Button variant="outline" size="sm" onClick={placeholder("Exportar PDF")}><FileText className="h-4 w-4 mr-1" />Exportar PDF</Button>
      <Button variant="outline" size="sm" onClick={placeholder("Exportar CSV")}><Download className="h-4 w-4 mr-1" />Exportar CSV</Button>
      <Button variant="outline" size="sm" onClick={placeholder("Compartir")}><Share2 className="h-4 w-4 mr-1" />Compartir reporte</Button>
    </div>
  );
}

// ───────────── Page ─────────────

function ReportsPage() {
  const lots = useStore((s) => s.lots);
  const phases = useStore((s) => s.phases);
  const wasteLogs = useStore((s) => s.wasteLogs);
  const variableLogs = useStore((s) => s.variableLogs);
  const moistureLogs = useStore((s) => s.moistureLogs);
  const reservations = useStore((s) => s.reservations);
  const alerts = useStore((s) => s.alerts);
  const customers = useStore((s) => s.customers);

  const harvestTickets = mockDb.harvestTickets;
  const processInstances = mockDb.processInstances;
  const processTemplates = mockDb.processTemplates;
  const qualitySamples = mockDb.qualitySamples;
  const farms = useFarms();
  const parcels = useParcels();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const inRange = (iso: string | null | undefined): boolean => {
    if (!iso) return true;
    const t = new Date(iso).getTime();
    if (filters.from && t < new Date(filters.from).getTime()) return false;
    if (filters.to && t > new Date(filters.to + "T23:59:59").getTime()) return false;
    return true;
  };

  const filteredLots = useMemo(() => {
    return lots.filter((l) => {
      const ht = harvestTickets.find((h) => h.id === l.harvest_ticket_id);
      if (filters.season !== "all" && (!ht || harvestSeasonOf(ht.harvest_date) !== filters.season)) return false;
      if (filters.farmId !== "all" && l.farm_id !== filters.farmId) return false;
      if (filters.parcelId !== "all" && l.parcel_id !== filters.parcelId) return false;
      if (filters.variety !== "all" && l.variety !== filters.variety) return false;
      if (filters.processType !== "all" && l.process_type !== filters.processType) return false;
      if (filters.physicalState !== "all" && l.physical_state !== filters.physicalState) return false;
      if (filters.commercialState !== "all" && l.commercial_state !== filters.commercialState) return false;
      if (filters.qualityStatus !== "all" && l.quality_status !== filters.qualityStatus) return false;
      if (!inRange(l.created_at)) return false;
      return true;
    });
  }, [lots, filters, harvestTickets]);

  const filteredLotIds = new Set(filteredLots.map((l) => l.id));

  // ──── PRODUCCIÓN ────
  const productionByFarm = useMemo(() => {
    const map = new Map<string, number>();
    harvestTickets.filter((h) => inRange(h.harvest_date)).forEach((h) => {
      if (filters.farmId !== "all" && h.farm_id !== filters.farmId) return;
      if (filters.season !== "all" && harvestSeasonOf(h.harvest_date) !== filters.season) return;
      const name = farms.find((f) => f.id === h.farm_id)?.name ?? "—";
      map.set(name, (map.get(name) ?? 0) + (h.qty_kg ?? 0));
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [harvestTickets, farms, filters]);

  const productionByParcel = useMemo(() => {
    const map = new Map<string, number>();
    harvestTickets.filter((h) => inRange(h.harvest_date)).forEach((h) => {
      const name = parcels.find((p) => p.id === h.parcel_id)?.name ?? "Sin parcela";
      map.set(name, (map.get(name) ?? 0) + (h.qty_kg ?? 0));
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [harvestTickets, parcels, filters]);

  const productionByVariety = useMemo(() => {
    const map = new Map<string, number>();
    filteredLots.forEach((l) => {
      map.set(l.variety, (map.get(l.variety) ?? 0) + l.qty_initial_kg);
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [filteredLots]);

  const productionByProcess = useMemo(() => {
    const map = new Map<string, number>();
    filteredLots.forEach((l) => {
      const name = processTypeLabel(l.process_type);
      map.set(name, (map.get(name) ?? 0) + l.qty_initial_kg);
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [filteredLots]);

  const productionBySeason = useMemo(() => {
    const map = new Map<string, number>();
    harvestTickets.forEach((h) => {
      const s = harvestSeasonOf(h.harvest_date);
      map.set(s, (map.get(s) ?? 0) + (h.qty_kg ?? 0));
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [harvestTickets]);

  const totalProductionKg = productionByFarm.reduce((a, b) => a + b.value, 0);

  // ──── INVENTARIO ────
  const invByPhysical = useMemo(() => {
    const map = new Map<PhysicalState, number>();
    filteredLots.forEach((l) => {
      map.set(l.physical_state, (map.get(l.physical_state) ?? 0) + l.qty_current_kg);
    });
    return Array.from(map, ([k, value]) => ({ name: physicalStateLabel[k] ?? k, value: Math.round(value) }));
  }, [filteredLots]);

  const invByLocation = useMemo(() => {
    const map = new Map<string, number>();
    filteredLots.forEach((l) => {
      const loc = l.current_location ?? "Sin ubicación";
      map.set(loc, (map.get(loc) ?? 0) + l.qty_current_kg);
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [filteredLots]);

  const invSummary = useMemo(() => {
    let available = 0, reserved = 0, committed = 0, blocked = 0;
    filteredLots.forEach((l) => {
      available += calcAvailableKg(l);
      reserved += l.qty_reserved_kg;
      committed += l.qty_committed_kg;
      blocked += l.qty_blocked_kg;
    });
    return { available, reserved, committed, blocked };
  }, [filteredLots]);

  const blockedByQuality = filteredLots
    .filter((l) => l.commercial_state === "bloqueado_calidad" || l.quality_status === "rechazado")
    .map((l) => ({ ...l }));

  const freeCoffee = filteredLots.filter(
    (l) =>
      calcAvailableKg(l) > 0 &&
      l.quality_status !== "rechazado" &&
      !["bloqueado_calidad", "bloqueado_humedad", "bloqueado_revision", "descartado"].includes(l.commercial_state),
  );

  // ──── PROCESOS ────
  const activePhases = phases.filter((p) => p.status === "running" || p.status === "paused");
  const activeByPhase = useMemo(() => {
    const map = new Map<string, number>();
    activePhases.forEach((p) => {
      const lot = lots.find((l) => l.id === processInstances.find((pi) => pi.id === p.process_instance_id)?.lot_id);
      if (lot && !filteredLotIds.has(lot.id)) return;
      map.set(p.name, (map.get(p.name) ?? 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [activePhases, lots, processInstances, filteredLotIds]);

  const phaseTimingRows = useMemo(() => {
    return activePhases.map((p) => {
      const real = phaseDurationHours(p);
      const expected = (p.expected_minutes ?? 0) / 60;
      const pi = processInstances.find((i) => i.id === p.process_instance_id);
      const lot = lots.find((l) => l.id === pi?.lot_id);
      const ratio = expected > 0 ? real / expected : null;
      let status: "ok" | "warn" | "danger" = "ok";
      if (ratio != null) {
        if (ratio > 1.2) status = "danger";
        else if (ratio > 0.9) status = "warn";
      }
      return { phaseName: p.name, lotCode: lot?.lot_code ?? "—", real: Math.round(real), expected: Math.round(expected), status };
    }).filter((r) => filteredLotIds.size === 0 || lots.some((l) => l.lot_code === r.lotCode && filteredLotIds.has(l.id)));
  }, [activePhases, processInstances, lots, filteredLotIds]);

  const dryingByProcess = useMemo(() => {
    const buckets = new Map<string, number[]>();
    phases.filter((p) => /secado/i.test(p.name) && p.ended_at).forEach((p) => {
      const pi = processInstances.find((i) => i.id === p.process_instance_id);
      const lot = lots.find((l) => l.id === pi?.lot_id);
      if (!lot) return;
      const key = processTypeLabel(lot.process_type);
      const arr = buckets.get(key) ?? [];
      arr.push(phaseDurationDays(p));
      buckets.set(key, arr);
    });
    return Array.from(buckets, ([name, arr]) => ({ name, value: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 }));
  }, [phases, processInstances, lots]);

  const overduePhases = phaseTimingRows.filter((r) => r.status === "danger");

  // ──── RENDIMIENTOS ────
  const yieldByLot = filteredLots
    .filter((l) => l.qty_initial_kg > 0)
    .map((l) => ({ name: l.lot_code, value: Math.round((l.qty_current_kg / l.qty_initial_kg) * 100) }));

  const yieldByProcess = useMemo(() => {
    const buckets = new Map<string, { c: number; i: number }>();
    filteredLots.forEach((l) => {
      const k = processTypeLabel(l.process_type);
      const b = buckets.get(k) ?? { c: 0, i: 0 };
      b.c += l.qty_current_kg; b.i += l.qty_initial_kg;
      buckets.set(k, b);
    });
    return Array.from(buckets, ([name, { c, i }]) => ({ name, value: i > 0 ? Math.round((c / i) * 100) : 0 }));
  }, [filteredLots]);

  const yieldByVariety = useMemo(() => {
    const buckets = new Map<string, { c: number; i: number }>();
    filteredLots.forEach((l) => {
      const b = buckets.get(l.variety) ?? { c: 0, i: 0 };
      b.c += l.qty_current_kg; b.i += l.qty_initial_kg;
      buckets.set(l.variety, b);
    });
    return Array.from(buckets, ([name, { c, i }]) => ({ name, value: i > 0 ? Math.round((c / i) * 100) : 0 }));
  }, [filteredLots]);

  const yieldByFarm = useMemo(() => {
    const buckets = new Map<string, { c: number; i: number }>();
    filteredLots.forEach((l) => {
      const name = farms.find((f) => f.id === l.farm_id)?.name ?? "—";
      const b = buckets.get(name) ?? { c: 0, i: 0 };
      b.c += l.qty_current_kg; b.i += l.qty_initial_kg;
      buckets.set(name, b);
    });
    return Array.from(buckets, ([name, { c, i }]) => ({ name, value: i > 0 ? Math.round((c / i) * 100) : 0 }));
  }, [filteredLots, farms]);

  const PARCHMENT = new Set(["pergamino_seco", "pergamino_humedo", "pergamino_en_secado", "trillado", "en_reposo"]);
  const GREEN = new Set(["verde", "oro_verde"]);

  const fruitToParchment = useMemo(() => {
    const arr = filteredLots.filter((l) => PARCHMENT.has(l.physical_state) && l.qty_initial_kg > 0)
      .map((l) => ({ name: l.lot_code, value: Math.round((l.qty_current_kg / l.qty_initial_kg) * 100) }));
    return arr;
  }, [filteredLots]);

  const parchmentToGreen = useMemo(() => {
    return filteredLots.filter((l) => GREEN.has(l.physical_state) && l.qty_initial_kg > 0)
      .map((l) => ({ name: l.lot_code, value: Math.round((l.qty_current_kg / l.qty_initial_kg) * 100) }));
  }, [filteredLots]);

  // ──── MERMAS ────
  const filteredWaste = wasteLogs.filter((w) => filteredLotIds.has(w.lot_id) && inRange(w.registered_at));

  const wasteByLot = useMemo(() => {
    const map = new Map<string, number>();
    filteredWaste.forEach((w) => {
      const code = lots.find((l) => l.id === w.lot_id)?.lot_code ?? w.lot_id;
      map.set(code, (map.get(code) ?? 0) + w.qty_kg);
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [filteredWaste, lots]);

  const wasteByPhase = useMemo(() => {
    const map = new Map<string, number>();
    filteredWaste.forEach((w) => {
      const ph = phases.find((p) => p.id === w.phase_instance_id);
      const name = ph?.name ?? "Sin fase";
      map.set(name, (map.get(name) ?? 0) + w.qty_kg);
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [filteredWaste, phases]);

  const wasteByProcess = useMemo(() => {
    const map = new Map<string, number>();
    filteredWaste.forEach((w) => {
      const lot = lots.find((l) => l.id === w.lot_id);
      const name = lot ? processTypeLabel(lot.process_type) : "—";
      map.set(name, (map.get(name) ?? 0) + w.qty_kg);
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [filteredWaste, lots]);

  const wasteByType = useMemo(() => {
    const map = new Map<string, number>();
    filteredWaste.forEach((w) => {
      map.set(wasteTypeLabel[w.waste_type], (map.get(wasteTypeLabel[w.waste_type]) ?? 0) + w.qty_kg);
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [filteredWaste]);

  const wasteHistorical = useMemo(() => {
    // Group waste by month
    const map = new Map<string, number>();
    wasteLogs.forEach((w) => {
      const d = new Date(w.registered_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + w.qty_kg);
    });
    const arr = Array.from(map, ([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => a.name.localeCompare(b.name));
    const avg = arr.length ? arr.reduce((a, b) => a + b.value, 0) / arr.length : 0;
    return { series: arr, avg: Math.round(avg) };
  }, [wasteLogs]);

  // ──── CALIDAD ────
  const lotQualityStatus = useMemo(() => {
    const map = new Map<QualityStatus, number>();
    filteredLots.forEach((l) => map.set(l.quality_status, (map.get(l.quality_status) ?? 0) + 1));
    return Array.from(map, ([k, value]) => ({ name: qualityStatusLabel[k], value }));
  }, [filteredLots]);

  const moistureByLot = useMemo(() => {
    return filteredLots
      .filter((l) => l.current_moisture != null)
      .map((l) => ({ name: l.lot_code, value: l.current_moisture as number }));
  }, [filteredLots]);

  const cupScores = useMemo(() => {
    return qualitySamples
      .filter((q) => filteredLotIds.has(q.lot_id) && q.score != null)
      .map((q) => {
        const lot = lots.find((l) => l.id === q.lot_id);
        return { name: lot?.lot_code ?? q.lot_id, value: q.score as number };
      });
  }, [qualitySamples, filteredLotIds, lots]);

  const defectsByLot = useMemo(() => {
    return qualitySamples
      .filter((q) => filteredLotIds.has(q.lot_id))
      .map((q) => {
        const lot = lots.find((l) => l.id === q.lot_id);
        return { name: lot?.lot_code ?? q.lot_id, value: (q.primary_defects ?? 0) + (q.secondary_defects ?? 0) };
      });
  }, [qualitySamples, filteredLotIds, lots]);

  // ──── RESERVAS ────
  const filteredReservations = reservations.filter((r) => filters.customerId === "all" || r.customer_id === filters.customerId);
  const activeReservations = filteredReservations.filter((r) => r.status === "reservada" || r.status === "confirmada" || r.status === "activa");
  const reservationsByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    filteredReservations.forEach((r) => {
      const name = customers.find((c) => c.id === r.customer_id)?.name ?? "—";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [filteredReservations, customers]);

  const committedByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    activeReservations.forEach((r) => {
      const name = customers.find((c) => c.id === r.customer_id)?.name ?? "—";
      map.set(name, (map.get(name) ?? 0) + r.qty_kg);
    });
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) }));
  }, [activeReservations, customers]);

  const now = Date.now();
  const reservationsExpiringSoon = activeReservations.filter((r) => {
    if (!r.expires_at) return false;
    const days = (new Date(r.expires_at).getTime() - now) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7;
  });
  const reservationsExpired = filteredReservations.filter((r) => r.status === "vencida" || (r.expires_at && new Date(r.expires_at).getTime() < now && r.status !== "entregada" && r.status !== "cancelada"));

  // ──── ALERTAS ────
  const lotsAtRisk = filteredLots.filter((l) =>
    l.commercial_state.startsWith("bloqueado") ||
    l.quality_status === "rechazado" ||
    (l.current_moisture != null && (l.current_moisture > 13 || l.current_moisture < 9)),
  );

  const lotsWithoutRecentVarLogs = filteredLots.filter((l) => {
    const last = variableLogs.filter((v) => v.lot_id === l.id).sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0];
    if (!last) return true;
    const days = (now - new Date(last.measured_at).getTime()) / (1000 * 60 * 60 * 24);
    return days > 3;
  });

  const lotsWithoutRecentMoisture = filteredLots.filter((l) => {
    const last = moistureLogs.filter((m) => m.lot_id === l.id).sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0];
    if (!last) return true;
    const days = (now - new Date(last.measured_at).getTime()) / (1000 * 60 * 60 * 24);
    return days > 3;
  });

  const criticalAlerts = alerts.filter((a) => a.severity === "danger" && a.status === "open");

  // ───────────── Render ─────────────

  return (
    <>
      <PageHeader
        eyebrow="REPORTES" title="Reportes"
        subtitle="Resúmenes claros que responden las preguntas del día a día."
      />

      <ExportBar />
      <FiltersBar filters={filters} setFilters={setFilters} onClear={() => setFilters(EMPTY_FILTERS)} />

      <Tabs defaultValue="produccion" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="produccion"><Sprout className="h-4 w-4 mr-1" />Producción</TabsTrigger>
          <TabsTrigger value="inventario"><Warehouse className="h-4 w-4 mr-1" />Inventario</TabsTrigger>
          <TabsTrigger value="procesos"><Workflow className="h-4 w-4 mr-1" />Procesos</TabsTrigger>
          <TabsTrigger value="rendimientos"><Gauge className="h-4 w-4 mr-1" />Rendimientos</TabsTrigger>
          <TabsTrigger value="mermas"><Trash2 className="h-4 w-4 mr-1" />Mermas</TabsTrigger>
          <TabsTrigger value="calidad"><Award className="h-4 w-4 mr-1" />Calidad</TabsTrigger>
          <TabsTrigger value="reservas"><BookmarkCheck className="h-4 w-4 mr-1" />Reservas</TabsTrigger>
          <TabsTrigger value="alertas"><Bell className="h-4 w-4 mr-1" />Alertas</TabsTrigger>
        </TabsList>

        {/* ───── PRODUCCIÓN ───── */}
        <TabsContent value="produccion" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={Sprout} label="Producción total" value={`${totalProductionKg.toLocaleString("es")} kg`} />
            <MetricCard icon={BarChart3} label="Lotes activos" value={String(filteredLots.length)} />
            <MetricCard icon={Workflow} label="Variedades" value={String(productionByVariety.length)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard title="Producción por finca" question="¿De dónde viene mi cosecha?" empty={!productionByFarm.length}>
              <SimpleBar data={productionByFarm} unit="kg" />
            </ReportCard>
            <ReportCard title="Producción por parcela" question="¿Qué parcelas rinden más?" empty={!productionByParcel.length}>
              <SimpleBar data={productionByParcel} unit="kg" color={CHART_COLORS[1]} />
            </ReportCard>
            <ReportCard title="Producción por variedad" question="¿Cuál variedad produce más?" empty={!productionByVariety.length}>
              <SimpleDonut data={productionByVariety} />
            </ReportCard>
            <ReportCard title="Producción por proceso" question="¿Qué proceso domino más?" empty={!productionByProcess.length}>
              <SimpleDonut data={productionByProcess} />
            </ReportCard>
            <ReportCard title="Producción por temporada" question="¿Cómo va la cosecha vs temporadas anteriores?" empty={!productionBySeason.length}>
              <SimpleBar data={productionBySeason} unit="kg" color={CHART_COLORS[2]} />
            </ReportCard>
          </div>
        </TabsContent>

        {/* ───── INVENTARIO ───── */}
        <TabsContent value="inventario" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard icon={Warehouse} label="Disponible" value={formatKg(invSummary.available)} />
            <MetricCard icon={BookmarkCheck} label="Reservado" value={formatKg(invSummary.reserved)} />
            <MetricCard icon={Workflow} label="Comprometido" value={formatKg(invSummary.committed)} />
            <MetricCard icon={AlertTriangle} label="Bloqueado" value={formatKg(invSummary.blocked)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard title="Inventario por estado físico" question="¿Cuánto café tengo y en qué estado?" empty={!invByPhysical.length}>
              <SimpleBar data={invByPhysical} unit="kg" />
            </ReportCard>
            <ReportCard title="Disponible vs reservado vs comprometido" question="¿Qué puedo vender hoy?" empty={!invSummary.available && !invSummary.reserved && !invSummary.committed}>
              <SimpleDonut data={[
                { name: "Disponible", value: Math.round(invSummary.available) },
                { name: "Reservado", value: Math.round(invSummary.reserved) },
                { name: "Comprometido", value: Math.round(invSummary.committed) },
              ]} />
            </ReportCard>
            <ReportCard title="Bloqueado por calidad" question="¿Qué lotes no puedo mover?" empty={!blockedByQuality.length} emptyMsg="No hay lotes bloqueados.">
              <SimpleTable
                rows={blockedByQuality.map((l) => ({
                  Lote: l.lot_code,
                  Variedad: l.variety,
                  Estado: commercialStateLabel[l.commercial_state],
                  Kg: formatKg(l.qty_current_kg),
                }))}
              />
            </ReportCard>
            <ReportCard title="Café libre para negociar" question="¿Qué tengo listo para vender?" empty={!freeCoffee.length}>
              <SimpleTable
                rows={freeCoffee.map((l) => ({
                  Lote: l.lot_code,
                  Variedad: l.variety,
                  Disponible: formatKg(calcAvailableKg(l)),
                  Estado: physicalStateLabel[l.physical_state],
                }))}
              />
            </ReportCard>
            <ReportCard title="Inventario por ubicación" question="¿Dónde está cada lote?" empty={!invByLocation.length}>
              <SimpleBar data={invByLocation} unit="kg" color={CHART_COLORS[3]} />
            </ReportCard>
          </div>
        </TabsContent>

        {/* ───── PROCESOS ───── */}
        <TabsContent value="procesos" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={Workflow} label="Lotes en proceso" value={String(activePhases.length)} />
            <MetricCard icon={AlertTriangle} label="Fuera de tiempo" value={String(overduePhases.length)} />
            <MetricCard icon={Gauge} label="Procesos personalizados" value={String(processInstances.filter((i) => i.is_custom).length)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard title="Lotes activos por fase" question="¿Cuántos lotes tengo en cada fase?" empty={!activeByPhase.length}>
              <SimpleBar data={activeByPhase} unit="lotes" />
            </ReportCard>
            <ReportCard title="Tiempo real vs esperado por fase" question="¿Qué fases se están atrasando?" empty={!phaseTimingRows.length}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={phaseTimingRows.map((r) => ({ name: `${r.lotCode} · ${r.phaseName}`, real: r.real, esperado: r.expected }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RTooltip formatter={(v: number) => `${v} h`} />
                  <Legend />
                  <Bar dataKey="real" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="esperado" fill={CHART_COLORS[4]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ReportCard>
            <ReportCard title="Tiempo promedio de secado por proceso" question="¿Qué proceso seca más rápido?" empty={!dryingByProcess.length}>
              <SimpleBar data={dryingByProcess} unit="días" color={CHART_COLORS[2]} />
            </ReportCard>
            <ReportCard title="Lotes fuera de tiempo esperado" question="¿Qué lotes hay que revisar ya?" empty={!overduePhases.length} emptyMsg="Todos los procesos van a tiempo.">
              <SimpleTable
                rows={overduePhases.map((r) => ({
                  Lote: r.lotCode,
                  Fase: r.phaseName,
                  "Real (h)": r.real,
                  "Esperado (h)": r.expected,
                }))}
              />
            </ReportCard>
            <ReportCard title="Desempeño de procesos personalizados" question="¿Cómo va mi proceso experimental?" empty={!processInstances.some((i) => i.is_custom)}>
              <SimpleTable
                rows={processInstances.filter((i) => i.is_custom).map((i) => {
                  const lot = lots.find((l) => l.id === i.lot_id);
                  return {
                    Lote: lot?.lot_code ?? "—",
                    Iniciado: i.started_at.slice(0, 10),
                    Estado: i.ended_at ? "Finalizado" : "En curso",
                  };
                })}
              />
            </ReportCard>
          </div>
        </TabsContent>

        {/* ───── RENDIMIENTOS ───── */}
        <TabsContent value="rendimientos" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard title="Rendimiento por lote" question="¿Cuánto café útil obtuve por lote?" empty={!yieldByLot.length}>
              <SimpleBar data={yieldByLot} unit="%" />
            </ReportCard>
            <ReportCard title="Rendimiento por proceso" question="¿Qué proceso rinde mejor?" empty={!yieldByProcess.length}>
              <SimpleBar data={yieldByProcess} unit="%" color={CHART_COLORS[1]} />
            </ReportCard>
            <ReportCard title="Rendimiento por variedad" question="¿Qué variedad rinde más?" empty={!yieldByVariety.length}>
              <SimpleBar data={yieldByVariety} unit="%" color={CHART_COLORS[2]} />
            </ReportCard>
            <ReportCard title="Rendimiento por finca" question="¿Cuál finca tiene mejor rendimiento?" empty={!yieldByFarm.length}>
              <SimpleBar data={yieldByFarm} unit="%" color={CHART_COLORS[3]} />
            </ReportCard>
            <ReportCard title="Rendimiento fruta → pergamino" question="¿Cuánto pergamino sale del cereza?" empty={!fruitToParchment.length}>
              <SimpleBar data={fruitToParchment} unit="%" />
            </ReportCard>
            <ReportCard title="Rendimiento pergamino → oro verde" question="¿Cuánto oro verde sale del pergamino?" empty={!parchmentToGreen.length}>
              <SimpleBar data={parchmentToGreen} unit="%" color={CHART_COLORS[1]} />
            </ReportCard>
          </div>
        </TabsContent>

        {/* ───── MERMAS ───── */}
        <TabsContent value="mermas" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={Trash2} label="Merma total" value={formatKg(filteredWaste.reduce((a, b) => a + b.qty_kg, 0))} />
            <MetricCard icon={BarChart3} label="Registros" value={String(filteredWaste.length)} />
            <MetricCard icon={Gauge} label="Promedio histórico/mes" value={`${wasteHistorical.avg} kg`} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard title="Merma por lote" question="¿Dónde estoy perdiendo café?" empty={!wasteByLot.length}>
              <SimpleBar data={wasteByLot} unit="kg" />
            </ReportCard>
            <ReportCard title="Merma por fase" question="¿En qué fase pierdo más?" empty={!wasteByPhase.length}>
              <SimpleBar data={wasteByPhase} unit="kg" color={CHART_COLORS[2]} />
            </ReportCard>
            <ReportCard title="Merma por proceso" question="¿Qué proceso genera más merma?" empty={!wasteByProcess.length}>
              <SimpleDonut data={wasteByProcess} />
            </ReportCard>
            <ReportCard title="Merma por tipo" question="¿Qué tipo de merma predomina?" empty={!wasteByType.length}>
              <SimpleDonut data={wasteByType} />
            </ReportCard>
            <ReportCard title="Merma vs promedio histórico" question="¿Estoy perdiendo más que de costumbre?" empty={!wasteHistorical.series.length}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={wasteHistorical.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RTooltip formatter={(v: number) => `${v} kg`} />
                  <Line type="monotone" dataKey="value" stroke={CHART_COLORS[3]} strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-2">Promedio mensual: {wasteHistorical.avg} kg</p>
            </ReportCard>
          </div>
        </TabsContent>

        {/* ───── CALIDAD ───── */}
        <TabsContent value="calidad" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard title="Estado de calidad por lote" question="¿Cuántos lotes están aprobados?" empty={!lotQualityStatus.length}>
              <SimpleDonut data={lotQualityStatus} />
            </ReportCard>
            <ReportCard title="Humedad por lote" question="¿Qué lotes están fuera de rango de humedad?" empty={!moistureByLot.length}>
              <SimpleBar data={moistureByLot} unit="%" color={CHART_COLORS[2]} />
            </ReportCard>
            <ReportCard title="Cup score por lote" question="¿Cuáles son mis mejores lotes en taza?" empty={!cupScores.length}>
              <SimpleBar data={cupScores} unit="pts" color={CHART_COLORS[1]} />
            </ReportCard>
            <ReportCard title="Defectos por lote" question="¿Qué lotes tienen más defectos?" empty={!defectsByLot.length}>
              <SimpleBar data={defectsByLot} unit="defectos" color={CHART_COLORS[3]} />
            </ReportCard>
            <ReportCard title="Lotes bloqueados por calidad" question="¿Qué lotes están retenidos por QC?" empty={!blockedByQuality.length} emptyMsg="No hay lotes bloqueados por calidad.">
              <SimpleTable
                rows={blockedByQuality.map((l) => ({
                  Lote: l.lot_code,
                  Variedad: l.variety,
                  Calidad: qualityStatusLabel[l.quality_status],
                  Comercial: commercialStateLabel[l.commercial_state],
                }))}
              />
            </ReportCard>
          </div>
        </TabsContent>

        {/* ───── RESERVAS ───── */}
        <TabsContent value="reservas" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={BookmarkCheck} label="Reservas activas" value={String(activeReservations.length)} />
            <MetricCard icon={AlertTriangle} label="Por vencer (≤7 días)" value={String(reservationsExpiringSoon.length)} />
            <MetricCard icon={AlertTriangle} label="Vencidas" value={String(reservationsExpired.length)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard title="Reservas activas" question="¿Qué tengo apartado para clientes?" empty={!activeReservations.length}>
              <SimpleTable
                rows={activeReservations.map((r) => {
                  const lot = lots.find((l) => l.id === r.lot_id);
                  const c = customers.find((c) => c.id === r.customer_id);
                  return {
                    Lote: lot?.lot_code ?? "—",
                    Cliente: c?.name ?? "—",
                    Kg: formatKg(r.qty_kg),
                    Vence: r.expires_at?.slice(0, 10) ?? "—",
                    Estado: reservationStatusLabel[r.status] ?? r.status,
                  };
                })}
              />
            </ReportCard>
            <ReportCard title="Reservas por cliente" question="¿Quién está apartando café?" empty={!reservationsByCustomer.length}>
              <SimpleBar data={reservationsByCustomer} unit="reservas" />
            </ReportCard>
            <ReportCard title="Café comprometido por cliente" question="¿Cuántos kg tengo apartados por cliente?" empty={!committedByCustomer.length}>
              <SimpleBar data={committedByCustomer} unit="kg" color={CHART_COLORS[1]} />
            </ReportCard>
            <ReportCard title="Reservas próximas a vencer" question="¿A qué cliente debo contactar pronto?" empty={!reservationsExpiringSoon.length} emptyMsg="No hay reservas próximas a vencer.">
              <SimpleTable
                rows={reservationsExpiringSoon.map((r) => ({
                  Lote: lots.find((l) => l.id === r.lot_id)?.lot_code ?? "—",
                  Cliente: customers.find((c) => c.id === r.customer_id)?.name ?? "—",
                  Vence: r.expires_at?.slice(0, 10) ?? "—",
                  Kg: formatKg(r.qty_kg),
                }))}
              />
            </ReportCard>
            <ReportCard title="Reservas vencidas" question="¿Qué reservas debo liberar o renegociar?" empty={!reservationsExpired.length} emptyMsg="Sin reservas vencidas.">
              <SimpleTable
                rows={reservationsExpired.map((r) => ({
                  Lote: lots.find((l) => l.id === r.lot_id)?.lot_code ?? "—",
                  Cliente: customers.find((c) => c.id === r.customer_id)?.name ?? "—",
                  Venció: r.expires_at?.slice(0, 10) ?? "—",
                  Kg: formatKg(r.qty_kg),
                }))}
              />
            </ReportCard>
          </div>
        </TabsContent>

        {/* ───── ALERTAS ───── */}
        <TabsContent value="alertas" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={AlertTriangle} label="Alertas críticas" value={String(criticalAlerts.length)} />
            <MetricCard icon={AlertTriangle} label="Lotes en riesgo" value={String(lotsAtRisk.length)} />
            <MetricCard icon={AlertTriangle} label="Fases atrasadas" value={String(overduePhases.length)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard title="Lotes en riesgo" question="¿Qué necesita mi atención hoy?" empty={!lotsAtRisk.length} emptyMsg="Todo tranquilo, sin riesgos.">
              <SimpleTable
                rows={lotsAtRisk.map((l) => ({
                  Lote: l.lot_code,
                  Estado: commercialStateLabel[l.commercial_state],
                  Calidad: qualityStatusLabel[l.quality_status],
                  Humedad: l.current_moisture != null ? `${l.current_moisture}%` : "—",
                }))}
              />
            </ReportCard>
            <ReportCard title="Sin variables registradas (>3 días)" question="¿Qué lotes no se están midiendo?" empty={!lotsWithoutRecentVarLogs.length} emptyMsg="Todos los lotes tienen registros recientes.">
              <SimpleTable
                rows={lotsWithoutRecentVarLogs.map((l) => ({
                  Lote: l.lot_code,
                  Variedad: l.variety,
                  Estado: physicalStateLabel[l.physical_state],
                }))}
              />
            </ReportCard>
            <ReportCard title="Sin medición de humedad reciente" question="¿Qué lotes necesitan humedad ya?" empty={!lotsWithoutRecentMoisture.length} emptyMsg="Humedad al día.">
              <SimpleTable
                rows={lotsWithoutRecentMoisture.map((l) => ({
                  Lote: l.lot_code,
                  Variedad: l.variety,
                  Estado: physicalStateLabel[l.physical_state],
                }))}
              />
            </ReportCard>
            <ReportCard title="Fases atrasadas" question="¿Qué procesos se pasaron del tiempo?" empty={!overduePhases.length} emptyMsg="Todo va a tiempo.">
              <SimpleTable
                rows={overduePhases.map((r) => ({
                  Lote: r.lotCode,
                  Fase: r.phaseName,
                  "Real (h)": r.real,
                  "Esperado (h)": r.expected,
                }))}
              />
            </ReportCard>
            <ReportCard title="Alertas críticas" question="¿Qué no puede esperar?" empty={!criticalAlerts.length} emptyMsg="Sin alertas críticas.">
              <div className="space-y-2">
                {criticalAlerts.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.message}</p>
                    </div>
                    <StatusBadge status="danger">Crítica</StatusBadge>
                  </div>
                ))}
              </div>
            </ReportCard>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

// ───────────── Tiny table ─────────────

function SimpleTable({ rows }: { rows: Record<string, React.ReactNode>[] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Sin datos.</p>;
  }
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
            {cols.map((c) => <th key={c} className="px-2 py-2 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((r, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              {cols.map((c) => <td key={c} className="px-2 py-2">{r[c]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 12 && <p className="text-xs text-muted-foreground text-center mt-2">+ {rows.length - 12} más</p>}
    </div>
  );
}
