import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/lots")({
  head: () => ({
    meta: [
      { title: "Lotes — Bitácora Café Pro" },
      { name: "description", content: "Administra tus lotes de café y su trazabilidad." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Lotes" subtitle="Cada lote sigue su propio camino." />
      <EmptyState
        icon={Boxes}
        title="Todavía no tienes lotes"
        description="Crea tu primer lote desde + Registrar para comenzar a seguirlo."
      />
    </>
  ),
});
