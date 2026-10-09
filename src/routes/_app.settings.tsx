import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { cloudSaveFarms, cloudSaveParcels, cloudSetMemberRole, getOrgId, useCloudState } from "@/lib/cloud";
import { createTeamUser } from "@/lib/users.functions";
import { isEvaluatorAccount, useMemberships } from "@/lib/auth";
import { EvaluationAccountCard } from "@/components/evaluation-account-card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCan } from "@/lib/permissions";
import { toast } from "sonner";
import { Building2, MapPin, Leaf, Users, Scale, Droplets, Workflow, Beaker, Plus, Trash2, Save, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmAction } from "@/components/confirm-action";
import { LoadState, SimpleTable, selectCls } from "@/components/ops-ui";
import { roleLabel, roleDescription, useCurrentRole, type AppRole } from "@/lib/permissions";
import { useFarms, useParcels } from "@/lib/app-config-store";
import { DEFAULT_ORG_SETTINGS, loadOrgSettings, saveOrgSettings, sel, useOrgQuery } from "@/lib/org-data";
import { friendlyError, requireOrg } from "@/lib/ops-cloud";
import type { Farm, Parcel } from "@/types/domain";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes — Bitácora Café Pro" },
      { name: "description", content: "Fincas, parcelas, equipo, conversiones de unidades, humedad, stock bajo y plantillas de la organización." },
      { property: "og:title", content: "Ajustes — Bitácora Café Pro" },
      { property: "og:description", content: "Configuración de la organización." },
    ],
  }),
  component: SettingsPage,
});

async function countRefs(col: "farm_id" | "parcel_id", id: string) {
  const [l, t] = await Promise.all([
    supabase.from("lots").select("id", { count: "exact", head: true }).eq(col, id),
    supabase.from("harvest_tickets").select("id", { count: "exact", head: true }).eq(col, id),
  ]);
  return { lotsUsing: l.count ?? 0, ticketsUsing: t.count ?? 0 };
}

function SettingsPage() {
  const role = useCurrentRole();
  const evaluator = isEvaluatorAccount(useMemberships());
  return (
    <>
      <PageHeader eyebrow="AJUSTES" title="Ajustes" subtitle="Todo se guarda para la organización elegida y se ve al instante en los demás dispositivos." />
      <Tabs defaultValue="org">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="org"><Building2 className="size-4" /> Organización</TabsTrigger>
          <TabsTrigger value="farms"><MapPin className="size-4" /> Fincas</TabsTrigger>
          <TabsTrigger value="parcels"><Leaf className="size-4" /> Parcelas</TabsTrigger>
          <TabsTrigger value="users"><Users className="size-4" /> Usuarios y roles</TabsTrigger>
          <TabsTrigger value="units"><Scale className="size-4" /> Conversiones</TabsTrigger>
          <TabsTrigger value="limits"><Droplets className="size-4" /> Humedad y stock</TabsTrigger>
          <TabsTrigger value="processes"><Workflow className="size-4" /> Plantillas</TabsTrigger>
          <TabsTrigger value="variables"><Beaker className="size-4" /> Variables</TabsTrigger>
        </TabsList>
        <TabsContent value="org" className="mt-4"><OrgSection /></TabsContent>
        <TabsContent value="farms" className="mt-4"><FarmsSection /></TabsContent>
        <TabsContent value="parcels" className="mt-4"><ParcelsSection /></TabsContent>
        <TabsContent value="users" className="mt-4">{evaluator ? <p className="text-sm text-muted-foreground">La cuenta de evaluación no gestiona usuarios ni roles.</p> : <><UsersRolesSection currentRole={role} /><EvaluationAccountCard /></>}</TabsContent>
        <TabsContent value="units" className="mt-4"><UnitsSection /></TabsContent>
        <TabsContent value="limits" className="mt-4"><LimitsSection /></TabsContent>
        <TabsContent value="processes" className="mt-4"><Card className="p-4 text-sm">Las plantillas se editan con versiones en el <Link to="/processes/custom-builder" className="underline">editor de plantillas</Link>.</Card></TabsContent>
        <TabsContent value="variables" className="mt-4"><VariablesSection /></TabsContent>
      </Tabs>
    </>
  );
}

// ───────────── Draft helpers ─────────────

function useDraft<T>(source: T): { draft: T; setDraft: (next: T | ((prev: T) => T)) => void; dirty: boolean; reset: () => void } {
  const [draft, setDraftState] = useState<T>(source);
  // When the upstream source changes (e.g. external save or reset), refresh draft.
  useEffect(() => { setDraftState(source); }, [source]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(source), [draft, source]);
  return {
    draft,
    setDraft: (next) => setDraftState((prev) => (typeof next === "function" ? (next as (p: T) => T)(prev) : next)),
    dirty,
    reset: () => setDraftState(source),
  };
}

function SaveBar({ dirty, onSave, onDiscard, extra }: { dirty: boolean; onSave: () => void; onDiscard: () => void; extra?: React.ReactNode }) {
  const canManage = useCan("settings.manage");
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <div className="text-xs text-muted-foreground">
        {!canManage ? "Solo lectura: tu rol no puede guardar ajustes." : dirty ? "Tienes cambios sin guardar." : "Sin cambios pendientes."}
      </div>
      <div className="flex items-center gap-2">
        {extra}
        <Button variant="outline" size="sm" onClick={onDiscard} disabled={!dirty}>
          <Undo2 className="size-4" /> Descartar
        </Button>
        <Button size="sm" onClick={onSave} disabled={!dirty || !canManage} title={canManage ? undefined : "Tu rol no permite cambiar ajustes"}>
          <Save className="size-4" /> Guardar cambios
        </Button>
      </div>
    </div>
  );
}

// ───────────── Fincas ─────────────

function FarmsSection() {
  const farms = useFarms();
  const { draft, setDraft, dirty, reset } = useDraft<Farm[]>(farms);

  const update = (id: string, patch: Partial<Farm>) =>
    setDraft((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const tryRemove = async (f: Farm) => {
    const { lotsUsing, ticketsUsing } = await countRefs("farm_id", f.id);
    if (lotsUsing > 0 || ticketsUsing > 0) {
      toast.error(`No se puede borrar "${f.name}": tiene ${lotsUsing} lote(s) y ${ticketsUsing} recibo(s) asociados.`);
      return;
    }
    setDraft((prev) => prev.filter((x) => x.id !== f.id));
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => {
          const now = new Date().toISOString();
          setDraft((prev) => [...prev, { id: crypto.randomUUID(), organization_id: getOrgId() ?? "", name: "Nueva finca", region: null, country: "Costa Rica", owner_name: null, altitude_m: null, notes: null, created_at: now, updated_at: now } as Farm]);
          toast.info("Finca añadida al borrador. Pulsa «Guardar cambios» para crearla.");
        }}>
          <Plus className="size-4" /> Añadir finca
        </Button>
      </div>
      <Card className="p-0 divide-y divide-border">
        {draft.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No hay fincas. Añade una para empezar.</div>
        ) : draft.map((f) => (
          <div key={f.id} className="p-3 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_120px_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input value={f.name} onChange={(e) => update(f.id, { name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Región</Label>
              <Input value={f.region ?? ""} onChange={(e) => update(f.id, { region: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">País</Label>
              <Input value={f.country ?? ""} onChange={(e) => update(f.id, { country: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Altitud (msnm)</Label>
              <Input
                type="number"
                value={f.altitude_m ?? ""}
                onChange={(e) => update(f.id, { altitude_m: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <ConfirmAction
              destructive
              title={`Borrar finca "${f.name}"`}
              description="Se eliminarán también sus parcelas. Esta acción no se puede deshacer."
              confirmLabel="Borrar"
              trigger={
                <Button size="icon" variant="ghost" aria-label="Borrar finca">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              }
              onConfirm={() => { tryRemove(f); }}
            />
          </div>
        ))}
      </Card>
      <SaveBar
        dirty={dirty}
        onDiscard={reset}
        onSave={() => {
          cloudSaveFarms(draft, farms)
            .then(() => toast.success("Fincas guardadas"))
            .catch((e: Error) => toast.error(e.message));
        }}
      />
    </div>
  );
}

// ───────────── Parcelas ─────────────

function ParcelsSection() {
  const parcels = useParcels();
  const farms = useFarms();
  const { draft, setDraft, dirty, reset } = useDraft<Parcel[]>(parcels);

  const update = (id: string, patch: Partial<Parcel>) =>
    setDraft((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const tryRemove = async (p: Parcel) => {
    const { lotsUsing, ticketsUsing } = await countRefs("parcel_id", p.id);
    if (lotsUsing > 0 || ticketsUsing > 0) {
      toast.error(`No se puede borrar "${p.name}": tiene ${lotsUsing} lote(s) y ${ticketsUsing} recibo(s) asociados.`);
      return;
    }
    setDraft((prev) => prev.filter((x) => x.id !== p.id));
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={farms.length === 0}
          onClick={() => {
            const now = new Date().toISOString();
            setDraft((prev) => [...prev, { id: crypto.randomUUID(), farm_id: farms[0].id, name: "Nueva parcela", variety: null, altitude_m: null, area_ha: null, notes: null, created_at: now, updated_at: now } as unknown as Parcel]);
            toast.info("Parcela añadida al borrador. Pulsa «Guardar cambios» para crearla.");
          }}
        >
          <Plus className="size-4" /> Añadir parcela
        </Button>
      </div>
      <Card className="p-0 divide-y divide-border">
        {draft.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No hay parcelas todavía.</div>
        ) : draft.map((p) => {
          const farm = farms.find((f) => f.id === p.farm_id);
          return (
            <div key={p.id} className="p-3 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_100px_100px_auto] gap-2 items-end">
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Finca</Label>
                <Select value={p.farm_id} onValueChange={(v) => update(p.id, { farm_id: v })}>
                  <SelectTrigger><SelectValue placeholder={farm?.name ?? "—"} /></SelectTrigger>
                  <SelectContent>
                    {farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Variedad</Label>
                <Input value={p.variety ?? ""} onChange={(e) => update(p.id, { variety: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Área (ha)</Label>
                <Input
                  type="number" step="0.1"
                  value={p.area_ha ?? ""}
                  onChange={(e) => update(p.id, { area_ha: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Altitud</Label>
                <Input
                  type="number"
                  value={p.altitude_m ?? ""}
                  onChange={(e) => update(p.id, { altitude_m: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </div>
              <ConfirmAction
                destructive
                title={`Borrar parcela "${p.name}"`}
                description="Esta acción no se puede deshacer."
                confirmLabel="Borrar"
                trigger={
                  <Button size="icon" variant="ghost" aria-label="Borrar parcela">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                }
                onConfirm={() => { tryRemove(p); }}
              />
            </div>
          );
        })}
      </Card>
      <SaveBar
        dirty={dirty}
        onDiscard={reset}
        onSave={() => {
          cloudSaveParcels(draft, parcels)
            .then(() => toast.success("Parcelas guardadas"))
            .catch((e: Error) => toast.error(e.message));
        }}
      />
    </div>
  );
}

// ───────────── Roles ─────────────

function UsersRolesSection({ currentRole }: { currentRole: AppRole }) {
  const roles: AppRole[] = ["administrador", "encargado_beneficio", "productor", "comercial", "consulta"];
  const isAdmin = currentRole === "administrador";
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: AppRole }[]>([]);
  const load = async () => {
    const org = getOrgId();
    if (!org) { setUsers([]); return; }
    // Team of the selected organization only.
    const { data: userRoles } = await supabase.from("memberships").select("user_id, role").eq("organization_id", org);
    const ids = (userRoles ?? []).map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", ids).order("created_at")
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    setUsers((profiles ?? []).map((p) => ({
      id: p.id, name: p.full_name ?? "", email: p.email ?? "",
      role: ((userRoles ?? []).find((r) => r.user_id === p.id)?.role ?? "consulta") as AppRole,
    })));
  };
  const cloudOrg = useCloudState().orgId;
  useEffect(() => { void load(); }, [currentRole, cloudOrg]);
  const changeRole = async (userId: string, role: AppRole) => {
    try { await cloudSetMemberRole(userId, role); }
    catch (e) { return toast.error((e as Error).message); }
    toast.success(`Rol actualizado: ${roleLabel[role]}`);
    void load();
  };
  const createUser = useServerFn(createTeamUser);
  const [nu, setNu] = useState({ full_name: "", email: "", password: "", role: "consulta" as AppRole });
  const [creating, setCreating] = useState(false);
  const addUser = async () => {
    setCreating(true);
    try {
      const org = getOrgId();
      if (!org) throw new Error("Sin organización activa");
      await createUser({ data: { ...nu, organizationId: org } });
      toast.success("Usuario creado. Compartile su correo y contraseña.");
      setNu({ full_name: "", email: "", password: "", role: "consulta" });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el usuario");
    } finally { setCreating(false); }
  };
  return (
    <div className="space-y-4">
      {isAdmin && (
        <Card className="p-4 space-y-3">
          <Label>Agregar usuario</Label>
          <p className="text-xs text-muted-foreground">Solo vos podés dar acceso. La contraseña debe tener al menos 8 caracteres.</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Nombre" value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} />
            <Input type="email" placeholder="correo@finca.com" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
            <Input type="password" placeholder="Contraseña inicial" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
            <Select value={nu.role} onValueChange={(v) => setNu({ ...nu, role: v as AppRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={addUser} disabled={creating || !nu.email || nu.password.length < 8 || !nu.full_name}>Crear usuario</Button>
        </Card>
      )}
      <Card className="p-4">
        <Label>Tu rol</Label>
        <p className="text-sm mt-1">{roleLabel[currentRole]}</p>
        <p className="text-xs text-muted-foreground mt-1">Solo un administrador puede crear cuentas y cambiar roles.</p>
      </Card>
      <Card className="p-0 divide-y divide-border">
        {users.map((u) => (
          <div key={u.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <div className="font-medium">{u.name || u.email}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </div>
            {isAdmin ? (
              <Select value={u.role} onValueChange={(v) => changeRole(u.id, v as AppRole)}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs">{roleLabel[u.role]}</span>
            )}
          </div>
        ))}
      </Card>
      <Card className="p-0 divide-y divide-border">
        {roles.map((r) => (
          <div key={r} className="p-3 text-sm">
            <div className="font-medium">{roleLabel[r]}</div>
            <div className="text-xs text-muted-foreground">{roleDescription[r]}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ───────────── Unidades ─────────────

// ───────────── Organización (solo lectura del registro real) ─────────────
function OrgSection() {
  const org = useOrgQuery<{ name: string; country: string; region: string | null; is_demo: boolean; eval_kind: string | null } | null>("s-org",
    async (o) => (await supabase.from("organizations").select("name,country,region,is_demo,eval_kind").eq("id", o).maybeSingle()).data, [], null);
  return (
    <Card className="p-4 text-sm space-y-1">
      <LoadState loading={org.loading} error={org.error} />
      {org.data && <><div className="font-serif text-xl">{org.data.name}</div><div>{org.data.country}{org.data.region ? ` · ${org.data.region}` : ""}</div>
        {org.data.eval_kind && <div className="text-muted-foreground">Entorno de evaluación ({org.data.eval_kind === "blank" ? "en blanco" : "con datos de ejemplo"}).</div>}</>}
    </Card>
  );
}

// ───────────── Conversiones de unidades por organización ─────────────
type U = { id: string; name: string; symbol: string; unit_type: string; kg_factor: number | null; is_configurable: boolean; notes: string | null };
function UnitsSection() {
  const can = useCan("settings.manage");
  const us = useOrgQuery<U[]>("s-units", (o) => sel("units", "*", o, "name", true), ["units"], []);
  const [n, setN] = useState({ name: "", symbol: "", kg: "" });
  const save = async (id: string, kg: string) => {
    const { error } = await supabase.from("units").update({ kg_factor: kg === "" ? null : Number(kg) }).eq("id", id);
    if (error) toast.error(friendlyError(error)); else toast.success("Conversión guardada");
  };
  return (
    <Card className="p-4 space-y-3">
      <p className="text-sm text-muted-foreground">Cuántos kg equivale cada unidad de recibo (cajuela, lata, saco…). Se usa al registrar cosecha.</p>
      <LoadState loading={us.loading} error={us.error} empty={!us.data.length} />
      {us.data.length > 0 && <SimpleTable head={["Unidad", "Símbolo", "Kg por unidad", ""]} rows={us.data.map((u) => [u.name, u.symbol,
        <Input key={u.id + String(u.kg_factor)} className="w-28" inputMode="decimal" defaultValue={u.kg_factor ?? ""} disabled={!can || u.symbol === "kg"} onBlur={(e) => { if (e.target.value !== String(u.kg_factor ?? "")) void save(u.id, e.target.value); }} />,
        can && u.symbol !== "kg" ? <Button size="sm" variant="ghost" onClick={async () => { const { error } = await supabase.from("units").delete().eq("id", u.id); if (error) toast.error(friendlyError(error)); }}><Trash2 className="size-4" /></Button> : null])} />}
      {can && <div className="flex flex-wrap gap-2">
        <Input className="w-40" placeholder="Nombre (Cajuela)" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <Input className="w-24" placeholder="Símbolo" value={n.symbol} onChange={(e) => setN({ ...n, symbol: e.target.value })} />
        <Input className="w-28" placeholder="Kg" inputMode="decimal" value={n.kg} onChange={(e) => setN({ ...n, kg: e.target.value })} />
        <Button disabled={!n.name || !n.symbol || !(Number(n.kg) > 0)} onClick={async () => {
          const { error } = await supabase.from("units").insert({ organization_id: requireOrg(), name: n.name, symbol: n.symbol, unit_type: "volumen", kg_factor: Number(n.kg), is_configurable: true });
          if (error) toast.error(friendlyError(error)); else { toast.success("Unidad agregada"); setN({ name: "", symbol: "", kg: "" }); }
        }}><Plus className="size-4" /> Agregar</Button>
      </div>}
    </Card>
  );
}

// ───────────── Humedad y stock bajo ─────────────
function LimitsSection() {
  const can = useCan("settings.manage");
  const st = useOrgQuery("s-lim", loadOrgSettings, ["org_settings"], DEFAULT_ORG_SETTINGS);
  const [d, setD] = useState(DEFAULT_ORG_SETTINGS);
  useEffect(() => { setD(st.data); }, [st.data]);
  const dirty = JSON.stringify(d) !== JSON.stringify(st.data);
  const valid = d.moisture_min > 0 && d.moisture_max > d.moisture_min && d.moisture_max <= 100 && d.low_stock_kg >= 0;
  const num = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: Number(e.target.value) });
  return (
    <Card className="p-4 space-y-3 max-w-xl">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Humedad mínima %</Label><Input inputMode="decimal" value={d.moisture_min} onChange={num("moisture_min")} disabled={!can} /></div>
        <div><Label>Humedad máxima %</Label><Input inputMode="decimal" value={d.moisture_max} onChange={num("moisture_max")} disabled={!can} /></div>
        <div><Label>Umbral de stock bajo (kg libres)</Label><Input inputMode="decimal" value={d.low_stock_kg} onChange={num("low_stock_kg")} disabled={!can} /></div>
        <div><Label>Peso por saco (kg)</Label><Input inputMode="decimal" value={d.default_sack_kg} onChange={num("default_sack_kg")} disabled={!can} /></div>
      </div>
      <p className="text-xs text-muted-foreground">Humedad por debajo del mínimo y lotes liberados con menos kg libres que el umbral generan alertas automáticas.</p>
      {!valid && <p className="text-xs text-destructive">Revisa los valores: el máximo debe ser mayor que el mínimo.</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" disabled={!dirty} onClick={() => setD(st.data)}><Undo2 className="size-4" /> Descartar</Button>
        <Button size="sm" disabled={!dirty || !can || !valid} onClick={async () => { try { await saveOrgSettings(requireOrg(), d); toast.success("Ajustes guardados"); } catch (e) { toast.error(friendlyError(e)); } }}><Save className="size-4" /> Guardar</Button>
      </div>
    </Card>
  );
}

// ───────────── Variables ─────────────
type VD = { id: string; name: string; unit: string | null; value_type: string; category: string; active: boolean; config: { min?: number; max?: number } };
function VariablesSection() {
  const can = useCan("process_template.manage");
  const vs = useOrgQuery<VD[]>("s-vars", (o) => sel("variable_definitions", "*", o, "name", true), ["variable_definitions"], []);
  const [n, setN] = useState({ name: "", unit: "", category: "proceso", min: "", max: "" });
  return (
    <Card className="p-4 space-y-3">
      <LoadState loading={vs.loading} error={vs.error} empty={!vs.data.length} emptyText="Sin variables propias. Las fases de plantilla ya traen las suyas." />
      {vs.data.length > 0 && <SimpleTable head={["Variable", "Unidad", "Categoría", "Rango", "Activa"]} rows={vs.data.map((v) => [v.name, v.unit ?? "—", v.category,
        v.config?.min != null ? `${v.config.min}–${v.config.max}` : "—",
        <input type="checkbox" checked={v.active} disabled={!can} onChange={async (e) => { const { error } = await supabase.from("variable_definitions").update({ active: e.target.checked }).eq("id", v.id); if (error) toast.error(friendlyError(error)); }} />])} />}
      {can && <div className="flex flex-wrap gap-2">
        <Input className="w-40" placeholder="Nombre" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <Input className="w-20" placeholder="Unidad" value={n.unit} onChange={(e) => setN({ ...n, unit: e.target.value })} />
        <select className={selectCls + " w-36"} value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })}>{["proceso", "calidad", "secado", "ambiente"].map((c) => <option key={c}>{c}</option>)}</select>
        <Input className="w-20" placeholder="Mín" value={n.min} onChange={(e) => setN({ ...n, min: e.target.value })} />
        <Input className="w-20" placeholder="Máx" value={n.max} onChange={(e) => setN({ ...n, max: e.target.value })} />
        <Button disabled={!n.name} onClick={async () => {
          const { error } = await supabase.from("variable_definitions").insert({ organization_id: requireOrg(), name: n.name, unit: n.unit || null, value_type: "number", category: n.category,
            config: { min: n.min === "" ? undefined : Number(n.min), max: n.max === "" ? undefined : Number(n.max) }, active: true });
          if (error) toast.error(friendlyError(error)); else { toast.success("Variable agregada"); setN({ ...n, name: "", unit: "", min: "", max: "" }); }
        }}><Plus className="size-4" /> Agregar</Button>
      </div>}
    </Card>
  );
}
