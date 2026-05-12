import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/process-control")({
  head: () => ({
    meta: [
      { title: "Control de proceso — Bitácora Café Pro" },
      { name: "description", content: "Sigue humedad, temperatura y variables clave de cada lote." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Control de proceso" subtitle="Variables y tiempos de cada fase." />
      <EmptyState
        icon={Activity}
        title="Sin mediciones aún"
        description="Registra humedad, temperatura y otras variables desde + Registrar."
      />
    </>
  ),
});
