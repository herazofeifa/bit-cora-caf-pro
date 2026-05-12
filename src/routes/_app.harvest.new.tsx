import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { HarvestForm } from "@/components/harvest-form";

export const Route = createFileRoute("/_app/harvest/new")({
  head: () => ({
    meta: [
      { title: "Nueva cosecha — Bitácora Café Pro" },
      { name: "description", content: "Registra una nueva jornada de cosecha paso a paso." },
    ],
  }),
  component: NewHarvestPage,
});

function NewHarvestPage() {
  return (
    <>
      <PageHeader title="Nueva cosecha" subtitle="Registremos juntos esta jornada en 4 pasos." />
      <HarvestForm kind="harvest" />
    </>
  );
}
