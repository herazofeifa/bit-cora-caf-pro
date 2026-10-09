import { createFileRoute } from "@tanstack/react-router";
import { getPublicLot } from "@/lib/public.functions";
import { PublicLotView, PublicNotFound, PublicShell, type PublicLot } from "@/components/public-lot-view";

export const Route = createFileRoute("/t/$token")({
  loader: ({ params }) => getPublicLot({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    const l = loaderData as unknown as PublicLot | undefined;
    const title = l ? `${l.name} · ${l.lot_code} — Trazabilidad` : "Trazabilidad de café";
    const desc = l ? `Origen, proceso y calidad del lote ${l.lot_code}${l.farm ? ` de ${l.farm.name}` : ""}.` : "Ficha pública de un lote de café.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title },
      { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] };
  },
  component: () => { const l = Route.useLoaderData() as unknown as PublicLot; return <PublicShell><PublicLotView lot={l} /></PublicShell>; },
  notFoundComponent: PublicNotFound,
  errorComponent: PublicNotFound,
});
