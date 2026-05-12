import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Coffee, MapPin, ChevronRight, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { useStore } from "@/lib/store";
import {
  calcAvailableKg,
  commercialStateLabel,
  formatKg,
  physicalStateLabel,
  physicalStateTone,
  qualityStatusLabel,
  qualityTone,
} from "@/lib/helpers";
import type { Lot } from "@/types/domain";

export const Route = createFileRoute("/_app/free-coffee")({
  head: () => ({
    meta: [
      { title: "Café libre para negociar — Bitácora Café Pro" },
      { name: "description", content: "Lotes con inventario libre, sin bloqueos y listos para vender." },
    ],
  }),
  component: FreeCoffeePage,
});

function isFreeForSale(lot: Lot): boolean {
  if (lot.commercial_state === "bloqueado_humedad" || lot.commercial_state === "bloqueado_calidad" || lot.commercial_state === "bloqueado_revision" || lot.commercial_state === "descartado") {
    return false;
  }
  if (lot.quality_status === "rechazado" || lot.quality_status === "observado") return false;
  // approved or manually released (we treat 'libre' / 'disponible' / 'reservado' (still has free portion) as ok)
  if (calcAvailableKg(lot) <= 0) return false;
  return true;
}

function FreeCoffeePage() {
  const lots = useStore((s) => s.lots);

  const free = useMemo(() => lots.filter(isFreeForSale).sort((a, b) => calcAvailableKg(b) - calcAvailableKg(a)), [lots]);

  const totalFree = free.reduce((acc, l) => acc + calcAvailableKg(l), 0);

  return (
    <>
      <PageHeader
        title="Café libre para negociar"
        subtitle="Lotes aprobados, sin bloqueos y con inventario disponible. Lo que podés ofrecer hoy mismo."
      />

      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-4 mb-6 flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center text-primary">
          <Sparkles className="size-5" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Total libre para vender</div>
          <div className="text-2xl font-semibold">{formatKg(totalFree)}</div>
        </div>
      </div>

      {free.length === 0 ? (
        <EmptyState
          icon={Coffee}
          title="Por ahora no hay café libre para negociar"
          description="Aprobá un lote en calidad o liberá café reservado para que aparezca acá."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {free.map((lot) => (
            <Link
              key={lot.id}
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

              <div className="mt-3 text-3xl font-semibold text-success">{formatKg(calcAvailableKg(lot))}</div>
              <div className="text-xs text-muted-foreground">disponibles</div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                <StatusBadge status={physicalStateTone(lot.physical_state)}>
                  {physicalStateLabel[lot.physical_state] ?? lot.physical_state}
                </StatusBadge>
                <StatusBadge status={qualityTone(lot.quality_status)}>
                  {qualityStatusLabel[lot.quality_status]}
                </StatusBadge>
                <StatusBadge status="success">{commercialStateLabel[lot.commercial_state] ?? lot.commercial_state}</StatusBadge>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {lot.current_location ?? "Sin ubicación"}
                {lot.current_moisture != null && <span>· Humedad {lot.current_moisture}%</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
