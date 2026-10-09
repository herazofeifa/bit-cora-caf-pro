import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { HarvestForm } from "@/components/harvest-form";

export const Route = createFileRoute("/_app/intake/new")({
  head: () => ({
    meta: [
      { title: "Nuevo recibo — Bitácora Café Pro" },
      { name: "description", content: "Registra café que llega al beneficio." },
    ],
  }),
  component: NewIntakePage,
});

function NewIntakePage() {
  return (
    <>
      <PageHeader eyebrow="RECIBOS" title="Nuevo recibo" subtitle="Café que entra al beneficio. Te guiamos en 4 pasos." />
      <HarvestForm kind="intake" />
    </>
  );
}
