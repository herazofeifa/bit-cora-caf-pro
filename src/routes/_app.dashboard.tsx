import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Bot, BookmarkCheck, Boxes, Sprout, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Kpi, LoadState, LotLink, Section, SimpleTable, stateLabel, type Lot } from "@/components/ops-ui";
import { fmtDate, fmtKg, sel, useOrgQuery } from "@/lib/org-data";
import { useCloudState } from "@/lib/cloud";
import { useMemberships, useSession } from "@/lib/auth";
import { roleLabel, useCurrentRole } from "@/lib/permissions";
import { overduePhases } from "@/lib/ops-cloud";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [
    { title: "Inicio — Bitácora Café Pro" },
    { name: "description", content: "Resumen del día: café libre, lotes en proceso, reservas activas y alertas de tu organización." },
    { property: "og:title", content: "Inicio — Bitácora Café Pro" },
    { property: "og:description", content: "Resumen operativo de la organización." },
  ] }),
  component: Dashboard,
});

type Ticket = { id: string; harvest_date: string; qty_kg: number | null; variety: string | null; lot_id: string | null; created_at: string };
type Alert = { id: string; message: string; severity: string; created_at: string; lot_id: string | null };
type Res = { id: string; status: string; qty_kg: number };

function Dashboard() {
  const { orgId } = useCloudState(); const ms = useMemberships(); const session = useSession(); const role = useCurrentRole();
  const org = ms.find((m) => m.organization_id === orgId);
  const lots = useOrgQuery<Lot[]>("d-lots", (o) => sel("lots", "*", o), ["lots"], []);
  const tickets = useOrgQuery<Ticket[]>("d-tk", (o) => sel("harvest_tickets", "id,harvest_date,qty_kg,variety,lot_id,created_at", o, "created_at", false, 5), ["harvest_tickets"], []);
  const alerts = useOrgQuery<Alert[]>("d-al", async (o) => (await sel<(Alert & { resolved_at: string | null })[]>("alerts", "id,message,severity,created_at,lot_id,resolved_at", o, "created_at", false, 50)).filter((a) => !a.resolved_at), ["alerts"], []);
  const res = useOrgQuery<Res[]>("d-res", (o) => sel("reservations", "id,status,qty_kg", o, "reserved_at"), ["reservations"], []);
  const overdue = useOrgQuery("d-ov", () => overduePhases(), ["process_phases"], [] as Awaited<ReturnType<typeof overduePhases>>);

  const L = lots.data; const sum = (f: (l: Lot) => number) => L.reduce((a, l) => a + Number(f(l) || 0), 0);
  const name = (session?.user.user_metadata?.full_name as string | undefined) || session?.user.email?.split("@")[0] || "";
  const inProcess = L.filter((l) => !l.sale_released && l.qty_current_kg > 0);
  const active = res.data.filter((r) => r.status === "reservada" || r.status === "confirmada");

  return (
    <>
      <PageHeader eyebrow={(org?.organization_name ?? "Organización").toUpperCase()} title={`Hola${name ? `, ${name}` : ""}`}
        subtitle={`${org ? roleLabel[org.role] ?? role : ""} · lo más importante de hoy, con los datos guardados de tu organización.`} />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <Kpi label="Café libre" value={fmtKg(sum((l) => l.qty_free_kg))} hint="Listo para vender" />
        <Kpi label="En proceso" value={fmtKg(inProcess.reduce((a, l) => a + Number(l.qty_current_kg), 0))} hint={`${inProcess.length} lotes`} />
        <Kpi label="Reservado / comprometido" value={fmtKg(sum((l) => l.qty_reserved_kg) + sum((l) => l.qty_committed_kg))} hint={`${active.length} reservas activas`} />
        <Kpi label="Alertas abiertas" value={alerts.data.length + overdue.data.length} tone={alerts.data.length + overdue.data.length ? "warn" : undefined} hint="Humedad, stock y procesos" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {[{ to: "/harvest", l: "Registrar cosecha", i: Sprout }, { to: "/lots", l: "Ver lotes", i: Boxes }, { to: "/waste", l: "Registrar merma", i: Trash2 },
          { to: "/reservations", l: "Reservar café", i: BookmarkCheck }, { to: "/copiloto", l: "Preguntar al copiloto", i: Bot }].map(({ to, l, i: I }) => (
          <Button key={to} asChild variant="outline" className="h-14 rounded-xl justify-start"><Link to={to}><I className="h-5 w-5 mr-2" />{l}</Link></Button>))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Alertas" action={<Link to="/alerts" className="text-sm underline"><Bell className="inline h-4 w-4" /> Ver todas</Link>}>
          <LoadState loading={alerts.loading} error={alerts.error} empty={!alerts.data.length && !overdue.data.length} emptyText="Todo en orden: no hay alertas abiertas." />
          <ul className="text-sm space-y-2">
            {overdue.data.slice(0, 5).map((o) => <li key={o.phase_id}>⏱ <LotLink id={o.lot_id} code={o.lot_code} /> · {o.phase_name}: {o.reason}</li>)}
            {alerts.data.slice(0, 6).map((a) => <li key={a.id} className={a.severity === "alta" ? "text-destructive" : ""}>{a.message} <span className="text-xs text-muted-foreground">· {fmtDate(a.created_at)}</span></li>)}
          </ul>
        </Section>
        <Section title="Últimas cosechas" action={<Link to="/intake" className="text-sm underline">Recibos</Link>}>
          <LoadState loading={tickets.loading} error={tickets.error} empty={!tickets.data.length} emptyText="Aún no hay cosechas registradas." />
          {tickets.data.length > 0 && <SimpleTable head={["Fecha", "Variedad", "Kg", "Lote"]} rows={tickets.data.map((t) => {
            const lot = L.find((l) => l.id === t.lot_id);
            return [t.harvest_date, t.variety ?? "—", fmtKg(t.qty_kg), lot ? <LotLink id={lot.id} code={lot.lot_code} /> : "—"];
          })} />}
        </Section>
        <Section title="Lotes recientes" className="lg:col-span-2" action={<Link to="/lots" className="text-sm underline">Todos</Link>}>
          <LoadState loading={lots.loading} error={lots.error} empty={!L.length} emptyText="Sin lotes todavía." />
          {L.length > 0 && <SimpleTable head={["Lote", "Nombre", "Estado", "Actual", "Libre", "Ver"]} rows={L.slice(0, 8).map((l) => [
            <LotLink id={l.id} code={l.lot_code} />, l.friendly_name, stateLabel(l.commercial_state), fmtKg(l.qty_current_kg), fmtKg(l.qty_free_kg),
            <Button asChild size="sm" variant="outline"><Link to="/lots/$id" params={{ id: l.id }}>Ver lote</Link></Button>])} />}
        </Section>
      </div>
    </>
  );
}
