import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes — Bitácora Café Pro" },
      { name: "description", content: "Preferencias de tu finca y de la app." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Ajustes" subtitle="Preferencias de tu finca y de la app." />
      <EmptyState
        icon={Settings}
        title="Pronto podrás personalizar todo"
        description="Aquí podrás configurar tu finca, equipo y preferencias."
      />
    </>
  ),
});
