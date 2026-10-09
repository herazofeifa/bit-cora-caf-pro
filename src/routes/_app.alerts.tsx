import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { LoadState, LotLink, Section, SimpleTable } from "@/components/ops-ui";
import { fmtDate, sel, useOrgQuery } from "@/lib/org-data";
import { friendlyError, overduePhases, resolveAlert } from "@/lib/ops-cloud";
import { useCurrentRole } from "@/lib/permissions";

export const Route = createFileRoute("/_app/alerts")({
  head: () => ({ meta: [
    { title: "Alertas — Bitácora Café Pro" },
    { name: "description", content: "Alertas de humedad, stock bajo, variables fuera de rango y procesos atrasados." },
    { property: "og:title", content: "Alertas — Bitácora Café Pro" },
    { property: "og:description", content: "Alertas operativas abiertas y resueltas." },
  ] }),
  component: AlertsPage,
});

type A = { id: string; lot_id: string | null; kind: string; severity: string; message: string; created_at: string; resolved_at: string | null };
const kindLabel: Record<string, string> = { stock_bajo: "Stock bajo", humedad: "Humedad", variable: "Variable fuera de rango", proceso: "Proceso" };

function AlertsPage() {
  const role = useCurrentRole(); const can = role !== "consulta" && role !== "productor";
  const al = useOrgQuery<A[]>("al", (o) => sel("alerts", "*", o, "created_at", false, 300), ["alerts"], []);
  const lots = useOrgQuery<{ id: string; lot_code: string }[]>("al-l", (o) => sel("lots", "id,lot_code", o), ["lots"], []);
  const ov = useOrgQuery("al-ov", () => overduePhases(), ["process_phases"], [] as Awaited<ReturnType<typeof overduePhases>>);
  const [show, setShow] = useState<"open" | "all">("open");
  const code = (id: string | null) => lots.data.find((l) => l.id === id)?.lot_code ?? "—";
  const rows = al.data.filter((a) => show === "all" || !a.resolved_at);
  return (
    <>
      <PageHeader eyebrow="ALERTAS" title="Alertas" subtitle="Se generan solas: humedad fuera de rango, stock bajo el umbral de Ajustes, variables y fases atrasadas."
        action={<Button variant="outline" onClick={() => setShow(show === "open" ? "all" : "open")}>{show === "open" ? "Ver también resueltas" : "Solo abiertas"}</Button>} />
      <div className="grid gap-4">
        <Section title={`Procesos atrasados (${ov.data.length})`}>
          <LoadState loading={ov.loading} error={ov.error} empty={!ov.data.length} emptyText="Ningún proceso atrasado." />
          {ov.data.length > 0 && <SimpleTable head={["Lote", "Fase", "Días", "Motivo"]} rows={ov.data.map((o) => [<LotLink id={o.lot_id} code={o.lot_code} />, o.phase_name, Number(o.elapsed_days).toFixed(1), o.reason])} />}
        </Section>
        <Section title={`Alertas ${show === "open" ? "abiertas" : ""} (${rows.length})`}>
          <LoadState loading={al.loading} error={al.error} empty={!rows.length} emptyText="Todo en orden." />
          {rows.length > 0 && <SimpleTable head={["Fecha", "Tipo", "Lote", "Mensaje", ""]} rows={rows.map((a) => [fmtDate(a.created_at), kindLabel[a.kind] ?? a.kind,
            a.lot_id ? <LotLink id={a.lot_id} code={code(a.lot_id)} /> : "—", <span className={a.severity === "alta" ? "text-destructive" : ""}>{a.message}</span>,
            a.resolved_at ? <span className="text-xs text-muted-foreground">Resuelta {fmtDate(a.resolved_at)}</span>
              : can ? <Button size="sm" variant="outline" onClick={async () => { try { await resolveAlert(a.id); toast.success("Alerta resuelta"); } catch (e) { toast.error(friendlyError(e)); } }}>Resolver</Button> : null])} />}
        </Section>
        <p className="text-sm text-muted-foreground">El umbral de stock bajo y el rango de humedad se configuran en <Link to="/settings" className="underline">Ajustes</Link>.</p>
      </div>
    </>
  );
}
