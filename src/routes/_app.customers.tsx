import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({
    meta: [
      { title: "Clientes — Bitácora Café Pro" },
      { name: "description", content: "Tus compradores y su historial." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Clientes" subtitle="Las personas y empresas que compran tu café." />
      <EmptyState
        icon={Users}
        title="Aún no tienes clientes"
        description="Agrega tu primer cliente para empezar a registrar reservas y ventas."
      />
    </>
  ),
});
