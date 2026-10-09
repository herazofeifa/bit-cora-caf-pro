import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FlaskConical, Plus, Sprout } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCloudState } from "@/lib/cloud";
import { useMemberships, switchOrganization } from "@/lib/auth";
import { useCurrentRole } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { createDemoEnvironment, friendlyError, listLots, overduePhases, requireOrg, type CloudLot } from "@/lib/ops-cloud";
import { commercialStateLabel } from "@/lib/helpers";
import { useServerFn } from "@tanstack/react-start";
import { createTeamUser } from "@/lib/users.functions";
import type { CommercialState } from "@/types/domain";

export const Route = createFileRoute("/_app/operacion/")({
  head: () => ({ meta: [
    { title: "Operación en el servidor — Bitácora Café Pro" },
    { name: "description", content: "Lotes, procesos, alertas y unidades guardados en el servidor y compartidos entre dispositivos." },
  ] }),
  component: OperacionHub,
});

function OperacionHub() {
  const cloud = useCloudState(); const role = useCurrentRole(); const memberships = useMemberships();
  const [lots, setLots] = useState<CloudLot[]>([]);
  const [overdue, setOverdue] = useState<Awaited<ReturnType<typeof overduePhases>>>([]);
  const [alerts, setAlerts] = useState<{ id: string; message: string; created_at: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string; symbol: string; kg_factor: number | null }[]>([]);
  const [unit, setUnit] = useState({ name: "", symbol: "", kg: "" });
  const [error, setError] = useState<string | null>(null);
  const createUser = useServerFn(createTeamUser);
  const [ev, setEv] = useState({ email: "", full_name: "", password: "", role: "consulta" as "consulta" | "productor" });

  const load = useCallback(async () => {
    try {
      const org = requireOrg();
      const [l, o, a, u] = await Promise.all([
        listLots(), overduePhases(),
        supabase.from("alerts").select("id,message,created_at").eq("organization_id", org).is("resolved_at", null).order("created_at", { ascending: false }).limit(20),
        supabase.from("units").select("id,name,symbol,kg_factor").eq("organization_id", org).order("name"),
      ]);
      setLots(l); setOverdue(o); setAlerts(a.data ?? []); setUnits(u.data ?? []); setError(null);
    } catch (e) { setError(friendlyError(e)); }
  }, []);

  useEffect(() => {
    if (!cloud.orgId) return;
    void load();
    const ch = supabase.channel(`ops-${cloud.orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lots", filter: `organization_id=eq.${cloud.orgId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `organization_id=eq.${cloud.orgId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [cloud.orgId, load]);

  async function addUnit() {
    const kg = Number(unit.kg);
    if (!unit.name.trim() || !/^[a-z0-9_]{1,20}$/.test(unit.symbol) || !Number.isFinite(kg) || kg <= 0) return toast.error("Nombre, símbolo (minúsculas) y kg > 0.");
    const { error } = await supabase.from("units").insert({ organization_id: requireOrg(), name: unit.name.trim(), symbol: unit.symbol, kg_factor: kg, is_configurable: true });
    if (error) return toast.error(friendlyError(error));
    setUnit({ name: "", symbol: "", kg: "" }); void load();
  }
  async function demo() {
    if (!confirm("Se creará una organización de demostración separada, con datos de prueba. Tus datos reales no se tocan. ¿Continuar?")) return;
    try { const org = await createDemoEnvironment(); toast.success("Entorno demo creado."); await switchOrganization(org); }
    catch (e) { toast.error(friendlyError(e)); }
  }

  if (cloud.status === "loading") return <p className="text-muted-foreground">Cargando…</p>;
  if (!cloud.orgId) return <p className="text-muted-foreground">Tu usuario no pertenece a ninguna organización.</p>;
  const active = memberships.find((m) => m.organization_id === cloud.orgId);

  return (
    <>
      <PageHeader eyebrow="OPERACIÓN · SERVIDOR" title="Operación compartida"
        subtitle="Todo lo de esta sección se guarda en el servidor y se ve igual en todos los dispositivos."
        action={<div className="flex gap-2">
          <Button asChild><Link to="/operacion/cosecha"><Sprout className="h-4 w-4 mr-1" />Cosecha</Link></Button>
          <Button asChild variant="outline"><Link to="/operacion/reportes">Reportes</Link></Button>
        </div>} />

      {memberships.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Organización:</span>
          {memberships.map((m) => (
            <Button key={m.organization_id} size="sm" variant={m.organization_id === cloud.orgId ? "default" : "outline"}
              onClick={() => void switchOrganization(m.organization_id)}>{m.organization_name}{m.is_demo ? " (demo)" : ""}</Button>))}
        </div>)}
      {active?.is_demo && <p className="mb-4 rounded-lg border border-border bg-muted p-3 text-sm">Estás en una organización de <b>demostración</b>. Los datos son de prueba.</p>}
      {error && <p className="mb-4 text-destructive text-sm">{error}</p>}

      {(overdue.length > 0 || alerts.length > 0) && (
        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-serif text-lg mb-2 flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Atención</h2>
          <ul className="text-sm space-y-1">
            {overdue.map((o) => <li key={o.phase_id}><Link className="underline" to="/operacion/lote/$id" params={{ id: o.lot_id }}>{o.lot_code}</Link> · {o.phase_name}: {o.reason} ({o.elapsed_days} días)</li>)}
            {alerts.map((a) => <li key={a.id}>{a.message}</li>)}
          </ul>
        </section>)}

      <section className="mb-8">
        <h2 className="font-serif text-xl mb-3">Lotes ({lots.length})</h2>
        {lots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm">
            <p className="font-medium mb-1">Tu primer lote en 3 pasos</p>
            <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
              <li>Agrega una finca en Ajustes (y la unidad de peso abajo si usas cajuelas).</li>
              <li>Registra la cosecha: se crea el lote automáticamente.</li>
              <li>Abre el lote para iniciar fases, medir y cerrar con el peso real.</li>
            </ol>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lots.map((l) => (
              <Link key={l.id} to="/operacion/lote/$id" params={{ id: l.id }} className="rounded-xl border border-border bg-card p-4 hover:bg-muted transition-colors">
                <div className="font-mono text-xs text-muted-foreground">{l.lot_code}</div>
                <div className="font-medium">{l.friendly_name}</div>
                <div className="text-sm text-muted-foreground">{l.variety || "—"} · {l.physical_state}</div>
                <div className="mt-2 text-sm">{commercialStateLabel[l.commercial_state as CommercialState] ?? l.commercial_state}</div>
                <div className="text-xs text-muted-foreground">{Number(l.qty_current_kg)} kg actual · {Number(l.qty_free_kg)} kg libres</div>
              </Link>))}
          </div>)}
      </section>

      <section className="mb-8 rounded-xl border border-border bg-card p-4">
        <h2 className="font-serif text-lg mb-2">Unidades de peso</h2>
        <ul className="text-sm mb-3">{units.map((u) => <li key={u.id}>{u.name} ({u.symbol}) = {u.kg_factor} kg</li>)}{units.length === 0 && <li className="text-muted-foreground">Solo kg.</li>}</ul>
        {role === "administrador" && (
          <div className="flex flex-wrap gap-2">
            <Input className="w-36" placeholder="Cajuela" value={unit.name} onChange={(e) => setUnit({ ...unit, name: e.target.value })} />
            <Input className="w-28" placeholder="cajuela" value={unit.symbol} onChange={(e) => setUnit({ ...unit, symbol: e.target.value })} />
            <Input className="w-24" placeholder="kg" inputMode="decimal" value={unit.kg} onChange={(e) => setUnit({ ...unit, kg: e.target.value })} />
            <Button size="sm" onClick={() => void addUnit()}><Plus className="h-4 w-4" /></Button>
          </div>)}
      </section>

      {role === "administrador" && active?.is_demo && (
        <section className="mb-6 rounded-xl border border-border p-4 text-sm">
          <h2 className="font-serif text-lg mb-1">Cuenta de evaluador</h2>
          <p className="text-muted-foreground mb-3">Solo pertenece a esta organización demo, con permisos mínimos. Escribe tú la contraseña; no se muestra ni se guarda en la app.</p>
          <div className="grid gap-2 md:grid-cols-4">
            <Input placeholder="correo" type="email" value={ev.email} onChange={(e) => setEv({ ...ev, email: e.target.value })} />
            <Input placeholder="nombre" value={ev.full_name} onChange={(e) => setEv({ ...ev, full_name: e.target.value })} />
            <Input placeholder="contraseña (mín. 8)" type="password" autoComplete="new-password" value={ev.password} onChange={(e) => setEv({ ...ev, password: e.target.value })} />
            <select className="h-10 rounded-md border border-input bg-background px-3" value={ev.role} onChange={(e) => setEv({ ...ev, role: e.target.value as "consulta" | "productor" })}>
              <option value="consulta">Consulta (solo lectura)</option><option value="productor">Productor</option></select>
          </div>
          <Button className="mt-2" variant="outline" onClick={async () => {
            try { await createUser({ data: { ...ev, organizationId: cloud.orgId! } }); toast.success("Cuenta de evaluador creada"); setEv({ email: "", full_name: "", password: "", role: "consulta" }); }
            catch (e) { toast.error(friendlyError(e)); }
          }}>Crear cuenta</Button>
        </section>)}

      {role === "administrador" && !active?.is_demo && (
        <section className="rounded-xl border border-border p-4 text-sm">
          <h2 className="font-serif text-lg mb-1 flex items-center gap-2"><FlaskConical className="h-5 w-5" />Entorno de demostración</h2>
          <p className="text-muted-foreground mb-3">Crea una organización aparte con cosecha, fases, alertas, reservas, entrega y ficha pública de ejemplo. No modifica tus datos ni usuarios.</p>
          <Button variant="outline" onClick={() => void demo()}>Crear entorno demo</Button>
        </section>)}
    </>
  );
}
