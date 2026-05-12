import { createFileRoute } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/traceability")({
  head: () => ({
    meta: [
      { title: "Trazabilidad — Bitácora Café Pro" },
      { name: "description", content: "El camino completo de cada lote, desde la planta hasta la salida." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Trazabilidad" subtitle="El camino de cada lote, paso a paso." />
      <EmptyState
        icon={GitBranch}
        title="Sin historial todavía"
        description="Aquí verás el origen, las fases y el destino de cada lote."
      />
    </>
  ),
});
