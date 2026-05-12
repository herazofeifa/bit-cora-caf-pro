import { createFileRoute } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/processes")({
  head: () => ({
    meta: [
      { title: "Procesos — Bitácora Café Pro" },
      { name: "description", content: "Define y sigue tus procesos: lavado, honey, natural y más." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Procesos" subtitle="Lavado, honey, natural y los tuyos propios." />
      <EmptyState
        icon={Workflow}
        title="Aún no hay procesos configurados"
        description="Crea tus procesos para asignarlos a cada lote."
      />
    </>
  ),
});
