import { createFileRoute } from "@tanstack/react-router";
import { getPublicReport } from "@/lib/public.functions";
import { PublicNotFound, PublicShell } from "@/components/public-lot-view";

type Snap = { title: string; created_at: string; expires_at: string;
  payload: { filters: Record<string, string>; tables: { title: string; head: string[]; rows: (string | number)[][] }[] } };

export const Route = createFileRoute("/r/$token")({
  loader: ({ params }) => getPublicReport({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    const s = loaderData as unknown as Snap | undefined;
    const title = s ? `${s.title} — Bitácora Café Pro` : "Resumen compartido";
    return { meta: [{ title }, { name: "description", content: "Resumen de operación compartido por un productor." },
      { property: "og:title", content: title }, { property: "og:description", content: "Resumen de operación compartido." },
      { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
  },
  component: () => {
    const s = Route.useLoaderData() as unknown as Snap;
    return <PublicShell>
      <h1 className="font-serif text-3xl mb-1">{s.title}</h1>
      <p className="text-xs text-muted-foreground mb-6">Copia publicada el {new Date(s.created_at).toLocaleString()} · disponible hasta {new Date(s.expires_at).toLocaleDateString()}</p>
      {s.payload.tables.map((t) => (
        <section key={t.title} className="mb-5"><h2 className="font-serif text-lg mb-1">{t.title}</h2>
          <table className="w-full text-sm"><thead><tr>{t.head.map((h) => <th key={h} className="text-left py-1">{h}</th>)}</tr></thead>
            <tbody>{t.rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="py-1">{c}</td>)}</tr>)}</tbody></table>
          {t.rows.length === 0 && <p className="text-sm text-muted-foreground">Sin registros.</p>}</section>))}
    </PublicShell>;
  },
  notFoundComponent: PublicNotFound,
  errorComponent: PublicNotFound,
});
