import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reportes — Bitácora Café Pro" },
      { name: "description", content: "Resúmenes de cosecha, rendimiento y ventas." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Reportes" subtitle="Tu cosecha y beneficio en números." />
      <EmptyState
        icon={BarChart3}
        title="Sin reportes por ahora"
        description="Cuando tengas datos, aquí encontrarás tus rendimientos y resúmenes."
      />
    </>
  ),
});
