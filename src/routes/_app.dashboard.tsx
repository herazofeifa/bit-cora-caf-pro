import { createFileRoute } from "@tanstack/react-router";
import { Sprout, Boxes, Warehouse, BookmarkCheck, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Inicio — Bitácora Café Pro" },
      { name: "description", content: "Resumen de tu cosecha, lotes e inventario." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Buen día"
        subtitle="Aquí está el resumen de tu finca y beneficio."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <MetricCard icon={Sprout} label="Cosecha activa" value="—" hint="Sin datos aún" />
        <MetricCard icon={Boxes} label="Lotes en proceso" value="—" hint="Sin datos aún" />
        <MetricCard icon={Warehouse} label="Inventario disponible" value="—" hint="Sin datos aún" />
        <MetricCard icon={BookmarkCheck} label="Reservas" value="—" hint="Sin datos aún" />
      </div>

      <EmptyState
        icon={BarChart3}
        title="Aún no hay datos para mostrar"
        description="Cuando registres cosechas y lotes, verás gráficos y tendencias aquí."
      />
    </>
  );
}
