import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { LoadState, Section, SimpleTable } from "@/components/ops-ui";
import { fmtDate, sel, useOrgQuery } from "@/lib/org-data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({ meta: [
    { title: "Auditoría — Bitácora Café Pro" },
    { name: "description", content: "Historial inalterable de acciones: quién hizo qué, cuándo y sobre qué registro." },
    { property: "og:title", content: "Auditoría — Bitácora Café Pro" },
    { property: "og:description", content: "Bitácora de acciones de la organización." },
  ] }),
  component: AuditPage,
});

type E = { id: number; actor_id: string | null; entity: string; entity_id: string; action: string; diff: unknown; created_at: string };

function AuditPage() {
  const log = useOrgQuery<E[]>("audit", (o) => sel("audit_log", "*", o, "created_at", false, 500), [], []);
  const people = useOrgQuery<{ id: string; full_name: string | null; email: string | null }[]>("a-p", async () => (await supabase.from("profiles").select("id,full_name,email")).data ?? [], [], []);
  const [q, setQ] = useState("");
  const who = (id: string | null) => { const p = people.data.find((x) => x.id === id); return p?.full_name || p?.email || (id ? "Otro usuario" : "Sistema"); };
  const rows = log.data.filter((e) => !q || `${e.entity} ${e.action} ${who(e.actor_id)} ${JSON.stringify(e.diff)}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader eyebrow="AUDITORÍA" title="Auditoría" subtitle="Cada acción importante queda registrada con autor y hora. Nadie puede editar ni borrar este historial." />
      <Input className="max-w-sm mb-4" placeholder="Buscar acción, usuario, registro…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Section title={`${rows.length} registros (últimos 500)`}>
        <LoadState loading={log.loading} error={log.error} empty={!rows.length} />
        {rows.length > 0 && <SimpleTable head={["Fecha", "Usuario", "Registro", "Acción", "Detalle"]} rows={rows.map((e) => [fmtDate(e.created_at), who(e.actor_id), e.entity, e.action,
          <span className="text-xs text-muted-foreground break-all line-clamp-2">{e.diff ? JSON.stringify(e.diff).slice(0, 160) : ""}</span>])} />}
      </Section>
    </>
  );
}
