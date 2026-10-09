import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PermissionGate } from "@/components/permission-gate";
import { Plus, Search, Sprout, MapPin, Calendar, Scale, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { useFarms, useParcels } from "@/lib/app-config-store";
import { unitLabel } from "@/lib/units";
import { formatKg } from "@/lib/helpers";

export const Route = createFileRoute("/_app/harvest")({
  head: () => ({
    meta: [
      { title: "Cosecha — Bitácora Café Pro" },
      { name: "description", content: "Registra y sigue tus cosechas día a día." },
    ],
  }),
  component: HarvestListPage,
});

function HarvestListPage() {
  const tickets = useStore((s) => s.harvestTickets.filter((t) => t.kind === "harvest"));
  const [q, setQ] = useState("");
  const [farmId, setFarmId] = useState<string>("all");
  const [variety, setVariety] = useState<string>("all");
  const [date, setDate] = useState<string>("");

  const farms = useFarms();
  const parcels = useParcels();
  const varieties = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.variety).filter(Boolean) as string[])),
    [tickets],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tickets.filter((t) => {
      if (farmId !== "all" && t.farm_id !== farmId) return false;
      if (variety !== "all" && t.variety !== variety) return false;
      if (date && t.harvest_date !== date) return false;
      if (term) {
        const farm = farms.find((f) => f.id === t.farm_id)?.name ?? "";
        const parcel = parcels.find((p) => p.id === t.parcel_id)?.name ?? "";
        const blob = `${farm} ${parcel} ${t.producer_name ?? ""} ${t.variety ?? ""} ${t.harvest_date}`.toLowerCase();
        if (!blob.includes(term)) return false;
      }
      return true;
    });
  }, [tickets, q, farmId, variety, date, farms, parcels]);

  return (
    <>
      <PageHeader
        eyebrow="COSECHA" title="Cosecha"
        subtitle="Registra el café recolectado en tu finca."
        action={
          <PermissionGate permission="lot.create" hint>
          <Button asChild className="h-11 rounded-xl">
            <Link to="/harvest/new">
              <Plus className="h-4 w-4" /> Nueva cosecha
            </Link>
          </Button>
          </PermissionGate>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar finca, productor, variedad..."
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        <Select value={farmId} onValueChange={setFarmId}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Finca" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las fincas</SelectItem>
            {farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={variety} onValueChange={setVariety}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Variedad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las variedades</SelectItem>
            {varieties.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Todavía no registraste cosechas"
          description="Podés empezar con el botón Nueva cosecha."
          action={
            <Button asChild>
              <Link to="/harvest/new"><Plus className="h-4 w-4" /> Nueva cosecha</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((t) => {
            const farm = farms.find((f) => f.id === t.farm_id);
            const parcel = parcels.find((p) => p.id === t.parcel_id);
            return (
              <li key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{farm?.name ?? "Finca"}</h3>
                    <p className="text-xs text-muted-foreground">
                      {parcel?.name ? `${parcel.name} · ` : ""}{t.variety ?? "—"}
                    </p>
                  </div>
                  {t.conversion_basis === "pending" ? (
                    <StatusBadge status="warning">Peso pendiente</StatusBadge>
                  ) : (
                    <StatusBadge status="success">Confirmado</StatusBadge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Detail icon={Calendar} label="Cosecha" value={new Date(t.harvest_date).toLocaleDateString("es")} />
                  <Detail icon={MapPin} label="Productor" value={t.producer_name ?? "—"} />
                  <Detail icon={Scale} label="Cantidad" value={`${t.qty_original} ${unitLabel(t.uom_original_id).split(" ")[0]}`} />
                  <Detail icon={Scale} label="En kg" value={t.qty_kg != null ? formatKg(t.qty_kg) : "Pendiente"} />
                </div>
                {t.notes && <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{t.notes}</p>}
                {t.conversion_basis === "pending" && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-warning-foreground">
                    <AlertTriangle className="h-3.5 w-3.5" /> Confirmá el peso cuando puedas
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Sprout; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
