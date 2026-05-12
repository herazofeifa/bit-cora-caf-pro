import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Warehouse, Search, MapPin, Droplet, AlertTriangle, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { mockDb } from "@/data/mock-data";
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
import type { Lot } from "@/types/domain";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({
    meta: [
      { title: "Inventario — Bitácora Café Pro" },
      { name: "description", content: "Café disponible, comprometido y total en bodega." },
    ],
  }),
  component: InventoryPage,
});

type GroupBy = "physical" | "commercial" | "lot" | "location" | "process" | "variety" | "customer";

const GROUP_LABELS: Record<GroupBy, string> = {
  physical: "Estado físico",
  commercial: "Estado comercial",
  lot: "Lote",
  location: "Ubicación",
  process: "Proceso",
  variety: "Variedad",
  customer: "Cliente reservado",
};

function InventoryPage() {
  const lots = useStore((s) => s.lots);
  const reservations = useStore((s) => s.reservations);
  const customers = useStore((s) => s.customers);
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("physical");
  const [physicalFilter, setPhysicalFilter] = useState<string>("all");
  const [commercialFilter, setCommercialFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lots.filter((l) => {
      if (physicalFilter !== "all" && l.physical_state !== physicalFilter) return false;
      if (commercialFilter !== "all" && l.commercial_state !== commercialFilter) return false;
      if (!q) return true;
      return (
        l.lot_code.toLowerCase().includes(q) ||
        l.friendly_name.toLowerCase().includes(q) ||
        l.variety.toLowerCase().includes(q)
      );
    });
  }, [lots, search, physicalFilter, commercialFilter]);

  const reservationByLot = useMemo(() => {
    const m = new Map<string, string[]>();
    reservations
      .filter((r) => r.status === "reservada" || r.status === "activa" || r.status === "confirmada")
      .forEach((r) => {
        const customer = customers.find((c) => c.id === r.customer_id)?.name ?? "—";
        const arr = m.get(r.lot_id) ?? [];
        arr.push(customer);
        m.set(r.lot_id, arr);
      });
    return m;
  }, [reservations, customers]);

  const groups = useMemo(() => {
    const map = new Map<string, Lot[]>();
    for (const l of filtered) {
      let key = "—";
      switch (groupBy) {
        case "physical":
          key = physicalStateLabel[l.physical_state] ?? l.physical_state;
          break;
        case "commercial":
          key = commercialStateLabel[l.commercial_state] ?? l.commercial_state;
          break;
        case "lot":
          key = l.lot_code;
          break;
        case "location":
          key = l.current_location ?? "Sin ubicación";
          break;
        case "process":
          key = mockDb.processTemplates.find((t) => t.id === l.process_template_id)?.name ?? l.process_type;
          break;
        case "variety":
          key = l.variety;
          break;
        case "customer": {
          const c = reservationByLot.get(l.id);
          key = c && c.length ? c.join(", ") : "Sin reserva";
          break;
        }
      }
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy, reservationByLot]);

  const totals = useMemo(() => {
    const sum = (fn: (l: Lot) => number) => filtered.reduce((acc, l) => acc + fn(l), 0);
    return {
      total: sum((l) => l.qty_current_kg),
      available: sum((l) => calcAvailableKg(l)),
      reserved: sum((l) => l.qty_reserved_kg),
      blocked: sum((l) => l.qty_blocked_kg),
      committed: sum((l) => l.qty_committed_kg),
    };
  }, [filtered]);

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle="Café disponible, reservado, comprometido y bloqueado en cada lote."
        action={
          <Button asChild variant="outline">
            <Link to="/free-coffee">Café libre para negociar</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <SummaryCard label="Total" value={totals.total} tone="neutral" />
        <SummaryCard label="Disponible" value={totals.available} tone="success" />
        <SummaryCard label="Reservado" value={totals.reserved} tone="info" />
        <SummaryCard label="Comprometido" value={totals.committed} tone="info" />
        <SummaryCard label="Bloqueado" value={totals.blocked} tone="warning" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lote, variedad o nombre…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={physicalFilter} onValueChange={setPhysicalFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Estado físico" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados físicos</SelectItem>
            {Object.entries(physicalStateLabel).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={commercialFilter} onValueChange={setCommercialFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Estado comercial" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los comerciales</SelectItem>
            {Object.entries(commercialStateLabel).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)} className="mb-4">
        <TabsList className="flex flex-wrap h-auto">
          {(Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => (
            <TabsTrigger key={g} value={g}>{GROUP_LABELS[g]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {groups.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Sin inventario que coincida"
          description="Cambia los filtros o registra una nueva entrada."
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([key, items]) => (
            <section key={key}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {key} <span className="text-muted-foreground/60">({items.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((lot) => (
                  <InventoryCard key={lot.id} lot={lot} reservedFor={reservationByLot.get(lot.id) ?? []} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "success" | "info" | "warning" | "neutral" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{formatKg(value)}</div>
      <StatusBadge status={tone} className="mt-2">{label}</StatusBadge>
    </div>
  );
}

function InventoryCard({ lot, reservedFor }: { lot: Lot; reservedFor: string[] }) {
  const available = calcAvailableKg(lot);
  const moisture = lot.current_moisture;
  const moistureStatus =
    moisture == null ? "neutral" : moisture > 12.5 ? "warning" : moisture < 9 ? "warning" : "success";
  return (
    <Link
      to="/lots/$id"
      params={{ id: lot.id }}
      className="group block rounded-xl border border-border bg-card p-4 hover:border-primary transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs text-muted-foreground">{lot.lot_code}</div>
          <div className="font-semibold">{lot.friendly_name}</div>
          <div className="text-xs text-muted-foreground">{lot.variety}</div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary" />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <StatusBadge status={physicalStateTone(lot.physical_state)}>
          {physicalStateLabel[lot.physical_state] ?? lot.physical_state}
        </StatusBadge>
        <StatusBadge status={commercialStateTone(lot.commercial_state)}>
          {commercialStateLabel[lot.commercial_state] ?? lot.commercial_state}
        </StatusBadge>
        <StatusBadge status={qualityTone(lot.quality_status)}>
          {qualityStatusLabel[lot.quality_status]}
        </StatusBadge>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 text-xs">
        <Row label="Total" value={formatKg(lot.qty_current_kg)} />
        <Row label="Disponible" value={formatKg(available)} strong />
        <Row label="Reservado" value={formatKg(lot.qty_reserved_kg)} />
        <Row label="Comprometido" value={formatKg(lot.qty_committed_kg)} />
        <Row label="Bloqueado" value={formatKg(lot.qty_blocked_kg)} />
        <Row label="Vendido" value={formatKg(lot.qty_sold_kg)} />
        <Row label="Stock seguridad" value={formatKg(lot.stock_safety_kg)} />
        <Row label="Humedad" value={moisture == null ? "—" : `${moisture}%`} />
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" />
          {lot.current_location ?? "Sin ubicación"}
        </span>
        {moistureStatus !== "success" && moisture != null && (
          <span className="inline-flex items-center gap-1 text-warning-foreground">
            <Droplet className="size-3" /> Humedad fuera de rango
          </span>
        )}
        {reservedFor.length > 0 && (
          <span className="inline-flex items-center gap-1 text-primary">
            <AlertTriangle className="size-3" /> Reservado para {reservedFor.join(", ")}
          </span>
        )}
      </div>
    </Link>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}
