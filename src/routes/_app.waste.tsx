import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/waste")({
  head: () => ({
    meta: [
      { title: "Mermas — Bitácora Café Pro" },
      { name: "description", content: "Pérdidas y descartes registrados durante el proceso." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Mermas" subtitle="Lo que se pierde durante el proceso." />
      <EmptyState
        icon={Trash2}
        title="No hay mermas registradas"
        description="Registra pérdidas y descartes para entender mejor tus rendimientos."
      />
    </>
  ),
});
