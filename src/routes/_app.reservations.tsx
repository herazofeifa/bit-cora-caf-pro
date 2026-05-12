import { createFileRoute } from "@tanstack/react-router";
import { BookmarkCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/reservations")({
  head: () => ({
    meta: [
      { title: "Reservas — Bitácora Café Pro" },
      { name: "description", content: "Café apartado para clientes." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Reservas" subtitle="Café apartado para tus clientes." />
      <EmptyState
        icon={BookmarkCheck}
        title="Sin reservas todavía"
        description="Reserva café para tus clientes desde + Registrar."
      />
    </>
  ),
});
