import { createFileRoute } from "@tanstack/react-router";
import { PackageOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/intake")({
  head: () => ({
    meta: [
      { title: "Recibos — Bitácora Café Pro" },
      { name: "description", content: "Recibe café en el beneficio y registra los pesos." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Recibos" subtitle="Café que entra al beneficio." />
      <EmptyState
        icon={PackageOpen}
        title="Sin recibos por ahora"
        description="Cuando llegue café al beneficio, regístralo aquí desde + Registrar."
      />
    </>
  ),
});
