import { createFileRoute } from "@tanstack/react-router";
import { Sprout } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/harvest")({
  head: () => ({
    meta: [
      { title: "Cosecha — Bitácora Café Pro" },
      { name: "description", content: "Registra y sigue tus cosechas día a día." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Cosecha" subtitle="Registra el café recolectado en tu finca." />
      <EmptyState
        icon={Sprout}
        title="Aún no hay cosechas registradas"
        description="Toca + Registrar para empezar tu primera jornada de cosecha."
      />
    </>
  ),
});
