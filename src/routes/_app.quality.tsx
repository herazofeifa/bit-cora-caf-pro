import { createFileRoute } from "@tanstack/react-router";
import { Award } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/quality")({
  head: () => ({
    meta: [
      { title: "Calidad — Bitácora Café Pro" },
      { name: "description", content: "Catación y control de calidad de cada lote." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Calidad" subtitle="Catación, puntajes y notas de tu café." />
      <EmptyState
        icon={Award}
        title="Aún no hay catación"
        description="Cuando registres puntajes y notas, los verás aquí por lote."
      />
    </>
  ),
});
