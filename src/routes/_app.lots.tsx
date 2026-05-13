import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { Boxes, Search, Filter, X, MapPin, Droplet, AlertTriangle, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { mockDb } from "@/data/mock-data";
import { useFarms } from "@/lib/app-config-store";
import {
  calcAvailableKg,
  commercialStateLabel,
  commercialStateTone,
  formatKg,
  physicalStateLabel,
  physicalStateTone,
  qualityStatusLabel,
  qualityTone,
} from "@/lib/helpers";
import type {
  CommercialState,
  Lot,
  PhysicalState,
  ProcessType,
  QualityStatus,
} from "@/types/domain";

export const Route = createFileRoute("/_app/lots")({
  head: () => ({
    meta: [
      { title: "Lotes — Bitácora Café Pro" },
      { name: "description", content: "Administra tus lotes de café y su trazabilidad." },
    ],
  }),
  component: LotsPage,
});

const PROCESS_LABEL: Record<ProcessType, string> = {
  lavado: "Lavado",
  honey: "Honey",
  natural: "Natural",
  anaerobico: "Anaeróbico",
  experimental: "Experimental",
  custom: "Personalizado",
};

interface Filters {
  q: string;
  process: ProcessType | "all";
  physical: PhysicalState | "all";
  commercial: CommercialState | "all";
  quality: QualityStatus | "all";
  phaseName: string | "all";
  hasAvailable: boolean;
  atRisk: boolean;
  customOnly: boolean;
}

const initialFilters: Filters = {
  q: "",
  process: "all",
  physical: "all",
  commercial: "all",
  quality: "all",
  phaseName: "all",
  hasAvailable: false,
  atRisk: false,
  customOnly: false,
};

function isAtRisk(lot: Lot): boolean {
  if (lot.current_moisture != null && lot.physical_state === "secado" && lot.current_moisture > 13) {
    return true;
  }
  if (mockDb.alerts.some((a) => a.lot_id === lot.id && a.status === "open" && a.severity !== "info")) {
    return true;
  }
  return false;
}

function lastActivityDate(lot: Lot): string {
  const dates: number[] = [new Date(lot.updated_at).getTime()];
  for (const m of mockDb.moistureLogs) if (m.lot_id === lot.id) dates.push(new Date(m.measured_at).getTime());
  for (const v of mockDb.variableLogs) if (v.lot_id === lot.id) dates.push(new Date(v.measured_at).getTime());
  for (const s of mockDb.stockMovements) if (s.lot_id === lot.id) dates.push(new Date(s.created_at).getTime());
  return new Date(Math.max(...dates)).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
  });
}

function LotsPage() {
  const matchRoute = useMatchRoute();
  const isDetail = matchRoute({ to: "/lots/$id" });
  if (isDetail) return <Outlet />;
  const lots = useStore((s) => s.lots);
  const farms = useFarms();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const phaseNames = useMemo(() => {
    const set = new Set<string>();
    mockDb.processPhaseInstances.forEach((p) => set.add(p.name));
    return Array.from(set);
  }, []);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return lots.filter((lot) => {
      const farm = farms.find((f) => f.id === lot.farm_id);
      const customers = mockDb.reservations
        .filter((r) => r.lot_id === lot.id)
        .map((r) => mockDb.customers.find((c) => c.id === r.customer_id)?.name?.toLowerCase() ?? "");
      if (q) {
        const hay = [
          lot.lot_code,
          lot.friendly_name,
          lot.variety,
          lot.process_type,
          farm?.name ?? "",
          lot.producer_name ?? "",
          ...customers,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.process !== "all" && lot.process_type !== filters.process) return false;
      if (filters.physical !== "all" && lot.physical_state !== filters.physical) return false;
      if (filters.commercial !== "all" && lot.commercial_state !== filters.commercial) return false;
      if (filters.quality !== "all" && lot.quality_status !== filters.quality) return false;
      if (filters.phaseName !== "all") {
        const phase = mockDb.processPhaseInstances.find((p) => p.id === lot.current_phase_id);
        if (phase?.name !== filters.phaseName) return false;
      }
      if (filters.hasAvailable && calcAvailableKg(lot) <= 0) return false;
      if (filters.atRisk && !isAtRisk(lot)) return false;
      if (filters.customOnly && !lot.is_custom_process) return false;
      return true;
    });
  }, [lots, filters]);

  const activeFilterCount =
    (filters.process !== "all" ? 1 : 0) +
    (filters.physical !== "all" ? 1 : 0) +
    (filters.commercial !== "all" ? 1 : 0) +
    (filters.quality !== "all" ? 1 : 0) +
    (filters.phaseName !== "all" ? 1 : 0) +
    (filters.hasAvailable ? 1 : 0) +
    (filters.atRisk ? 1 : 0) +
    (filters.customOnly ? 1 : 0);

  return (
    <>
      <PageHeader
        eyebrow="LOTES" title="Lotes"
        subtitle="Cada lote sigue su propio camino. Toca uno para ver su historia completa."
      />

      {/* Search + filters bar */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Buscar por código, finca, productor, variedad…"
            className="pl-9"
          />
        </div>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="shrink-0 relative">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Filtros</span>
              {activeFilterCount > 0 && (
                <Badge className="ml-1 h-5 min-w-5 px-1.5">{activeFilterCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              <FilterSelect
                label="Tipo de proceso"
                value={filters.process}
                onChange={(v) => setFilters((f) => ({ ...f, process: v as Filters["process"] }))}
                options={[
                  { value: "all", label: "Todos" },
                  ...Object.entries(PROCESS_LABEL).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
              <FilterSelect
                label="Fase actual"
                value={filters.phaseName}
                onChange={(v) => setFilters((f) => ({ ...f, phaseName: v }))}
                options={[
                  { value: "all", label: "Todas" },
                  ...phaseNames.map((n) => ({ value: n, label: n })),
                ]}
              />
              <FilterSelect
                label="Estado físico"
                value={filters.physical}
                onChange={(v) => setFilters((f) => ({ ...f, physical: v as Filters["physical"] }))}
                options={[
                  { value: "all", label: "Todos" },
                  ...Object.entries(physicalStateLabel).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
              <FilterSelect
                label="Estado comercial"
                value={filters.commercial}
                onChange={(v) => setFilters((f) => ({ ...f, commercial: v as Filters["commercial"] }))}
                options={[
                  { value: "all", label: "Todos" },
                  ...Object.entries(commercialStateLabel).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
              <FilterSelect
                label="Estado de calidad"
                value={filters.quality}
                onChange={(v) => setFilters((f) => ({ ...f, quality: v as Filters["quality"] }))}
                options={[
                  { value: "all", label: "Todos" },
                  ...Object.entries(qualityStatusLabel).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
              <FilterToggle
                label="Solo con inventario disponible"
                checked={filters.hasAvailable}
                onChange={(v) => setFilters((f) => ({ ...f, hasAvailable: v }))}
              />
              <FilterToggle
                label="Solo en riesgo"
                checked={filters.atRisk}
                onChange={(v) => setFilters((f) => ({ ...f, atRisk: v }))}
              />
              <FilterToggle
                label="Solo procesos personalizados"
                checked={filters.customOnly}
                onChange={(v) => setFilters((f) => ({ ...f, customOnly: v }))}
              />

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setFilters(initialFilters)}
              >
                <X className="h-4 w-4 mr-2" /> Limpiar filtros
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Result count */}
      <p className="mb-3 text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "lote" : "lotes"}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Cuando registres una cosecha, vas a poder crear tu primer lote"
          description="Probá ajustar la búsqueda o empezá una cosecha desde el asistente."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lot) => (
            <LotCard key={lot.id} lot={lot} />
          ))}
        </div>
      )}
    </>
  );
}

function LotCard({ lot }: { lot: Lot }) {
  const farm = useFarms().find((f) => f.id === lot.farm_id);
  const phase = mockDb.processPhaseInstances.find((p) => p.id === lot.current_phase_id);
  const available = calcAvailableKg(lot);
  const risk = isAtRisk(lot);

  return (
    <Link
      to="/lots/$id"
      params={{ id: lot.id }}
      className="group block rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium text-muted-foreground">{lot.lot_code}</span>
            {lot.is_custom_process && (
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                Personalizado
              </Badge>
            )}
            {risk && (
              <span title="En riesgo" className="inline-flex items-center text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
          <h3 className="mt-0.5 font-display text-lg font-semibold leading-tight truncate">
            {lot.friendly_name}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {lot.variety} · {PROCESS_LABEL[lot.process_type]}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusBadge status={physicalStateTone(lot.physical_state)}>
          {physicalStateLabel[lot.physical_state]}
        </StatusBadge>
        <StatusBadge status={commercialStateTone(lot.commercial_state)}>
          {commercialStateLabel[lot.commercial_state]}
        </StatusBadge>
        <StatusBadge status={qualityTone(lot.quality_status)}>
          {qualityStatusLabel[lot.quality_status]}
        </StatusBadge>
      </div>

      {phase && (
        <p className="mt-3 text-xs text-muted-foreground">
          Fase actual: <span className="text-foreground font-medium">{phase.name}</span>
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-center">
        <Metric label="Actual" value={formatKg(lot.qty_current_kg)} />
        <Metric label="Disponible" value={formatKg(available)} accent="success" />
        <Metric label="Reservado" value={formatKg(lot.qty_reserved_kg)} />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Droplet className="h-3 w-3" />
          {lot.current_moisture != null ? `${lot.current_moisture}%` : "—"}
        </span>
        <span className="inline-flex items-center gap-1 truncate">
          <MapPin className="h-3 w-3" />
          {lot.current_location ?? farm?.name ?? "—"}
        </span>
        <span>{lastActivityDate(lot)}</span>
      </div>
    </Link>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "success" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${accent === "success" ? "text-success" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
      <Label className="text-sm cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
