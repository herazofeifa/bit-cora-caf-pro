import { createFileRoute } from "@tanstack/react-router";
import { Warehouse } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({
    meta: [
      { title: "Inventario — Bitácora Café Pro" },
      { name: "description", content: "Café disponible, comprometido y total en bodega." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Inventario" subtitle="Café disponible, comprometido y total." />
      <EmptyState
        icon={Warehouse}
        title="La bodega está vacía"
        description="Cuando termines de procesar lotes, los verás aquí listos para vender."
      />
    </>
  ),
});
