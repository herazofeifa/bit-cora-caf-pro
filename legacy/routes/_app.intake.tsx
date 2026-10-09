import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PermissionGate } from "@/components/permission-gate";
import { Plus, PackageOpen, Search, Calendar, Scale, MapPin, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { useFarms } from "@/lib/app-config-store";
import { unitLabel } from "@/lib/units";
import { formatKg } from "@/lib/helpers";

export const Route = createFileRoute("/_app/intake")({
  head: () => ({
    meta: [
      { title: "Recibos — Bitácora Café Pro" },
      { name: "description", content: "Recibe café en el beneficio y registra los pesos." },
    ],
  }),
  component: IntakeListPage,
});

function IntakeListPage() {
  const records = useStore((s) => s.harvestTickets.filter((t) => t.kind === "intake"));
  const lots = useStore((s) => s.lots);
  const farms = useFarms();
  const [q, setQ] = useState("");
  const [farmId, setFarmId] = useState("all");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return records.filter((r) => {
      if (farmId !== "all" && r.farm_id !== farmId) return false;
      if (!term) return true;
      const farm = farms.find((f) => f.id === r.farm_id)?.name ?? "";
      return `${farm} ${r.producer_name ?? ""} ${r.variety ?? ""}`.toLowerCase().includes(term);
    });
  }, [records, q, farmId, farms]);

  const pendingLot = filtered.filter((r) => !lots.some((l) => l.harvest_ticket_id === r.id));

  return (
    <>
      <PageHeader
        eyebrow="RECIBOS" title="Recibos"
        subtitle="Café que entra al beneficio."
        action={
          <PermissionGate permission="intake.create" hint>
          <Button asChild className="h-11 rounded-xl">
            <Link to="/intake/new">
              <Plus className="h-4 w-4" /> Nuevo recibo
            </Link>
          </Button>
          </PermissionGate>
        }
      />

      {pendingLot.length > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 mb-5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-warning-foreground" />
            <div>
              <p className="text-sm font-medium text-warning-foreground">
                {pendingLot.length} recibo{pendingLot.length !== 1 ? "s" : ""} sin lote asignado
              </p>
              <p className="text-xs text-muted-foreground">Crea un lote o agrupa con uno existente para empezar a procesar.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3 mb-5">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productor, finca, variedad..." className="pl-9 h-11 rounded-xl" />
        </div>
        <Select value={farmId} onValueChange={setFarmId}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Finca" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las fincas</SelectItem>
            {farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Sin recibos por ahora"
          description="Cuando llegue café al beneficio, regístralo aquí."
          action={
            <Button asChild>
              <Link to="/intake/new"><Plus className="h-4 w-4" /> Nuevo recibo</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => {
            const farm = farms.find((f) => f.id === r.farm_id);
            const hasLot = lots.some((l) => l.harvest_ticket_id === r.id);
            const kgConfirmed = r.qty_kg != null && r.conversion_basis !== "pending";
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{farm?.name ?? "Finca"}</h3>
                    <p className="text-xs text-muted-foreground">
                      {r.producer_name ?? "—"} · {r.variety ?? "—"}
                    </p>
                  </div>
                  {hasLot ? (
                    <StatusBadge status="success">Con lote</StatusBadge>
                  ) : (
                    <StatusBadge status="warning">Sin lote</StatusBadge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Detail icon={Calendar} label="Fecha" value={new Date(r.harvest_date).toLocaleDateString("es")} />
                  <Detail icon={MapPin} label="Origen" value={farm?.region ?? "—"} />
                  <Detail icon={Scale} label="Recibido" value={`${r.qty_original} ${unitLabel(r.uom_original_id).split(" ")[0]}`} />
                  <Detail icon={Scale} label="Peso kg" value={kgConfirmed ? formatKg(r.qty_kg) : "Pendiente"} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof PackageOpen; label: string; value: string }) {
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
