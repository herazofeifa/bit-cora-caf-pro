import { createFileRoute } from "@tanstack/react-router";
import { getPublicSack } from "@/lib/public.functions";
import { PublicLotView, PublicNotFound, PublicShell, type PublicLot } from "@/components/public-lot-view";

type SackData = { sack: { seq: number; weight_kg: number | null; created_at: string }; lot: PublicLot };

export const Route = createFileRoute("/s/$token")({
  loader: ({ params }) => getPublicSack({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    const d = loaderData as unknown as SackData | undefined;
    const title = d ? `Saco #${d.sack.seq} · ${d.lot.lot_code} — Trazabilidad` : "Saco de café — Trazabilidad";
    const desc = d ? `Origen del saco #${d.sack.seq} del lote ${d.lot.lot_code}.` : "Origen de un saco de café.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title },
      { property: "og:description", content: desc }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] };
  },
  component: () => {
    const d = Route.useLoaderData() as unknown as SackData;
    return <PublicShell>
      <p className="text-center eyebrow mb-4">Saco #{d.sack.seq}{d.sack.weight_kg ? ` · ${d.sack.weight_kg} kg` : ""}</p>
      <PublicLotView lot={d.lot} />
    </PublicShell>;
  },
  notFoundComponent: PublicNotFound,
  errorComponent: PublicNotFound,
});
