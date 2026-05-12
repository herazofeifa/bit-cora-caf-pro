import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { useCan } from "@/lib/permissions";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({
    meta: [
      { title: "Auditoría — Bitácora Café Pro" },
      { name: "description", content: "Registro de cambios críticos en el sistema." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const allowed = useCan("audit.view");
  const audit = useStore((s) => s.audit);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return audit;
    return audit.filter((a) =>
      [a.entity, a.entity_id, a.action, JSON.stringify(a.diff ?? {})].join(" ").toLowerCase().includes(term),
    );
  }, [audit, q]);

  if (!allowed) {
    return (
      <>
        <PageHeader title="Auditoría" subtitle="Registro de cambios críticos." />
        <EmptyState icon={ScrollText} title="Acceso restringido" description="Tu rol no tiene permiso para ver la auditoría." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Quién hizo qué y cuándo." />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por entidad, acción o ID…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="Sin registros" description="Cuando ocurran acciones críticas aparecerán aquí." />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {filtered.map((a) => (
            <div key={a.id} className="p-3 grid grid-cols-1 md:grid-cols-[160px_140px_120px_1fr] gap-2 text-sm">
              <div className="text-muted-foreground">{new Date(a.created_at).toLocaleString("es")}</div>
              <div><span className="font-medium">{a.entity}</span></div>
              <div className="uppercase text-xs">{a.action}</div>
              <div className="text-muted-foreground break-all">
                <span className="text-foreground">{a.actor_id ?? "sistema"}</span>
                {" · "}#{a.entity_id.slice(0, 10)}
                {a.diff && (
                  <pre className="mt-1 text-xs whitespace-pre-wrap bg-muted/40 rounded p-2">{JSON.stringify(a.diff, null, 2)}</pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
