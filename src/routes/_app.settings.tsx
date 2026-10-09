import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { cloudSaveFarms, cloudSaveParcels, cloudSetMemberRole, getOrgId, useCloudState } from "@/lib/cloud";
import { loadDemoData, resetOperationalData } from "@/lib/store";
import { createTeamUser } from "@/lib/users.functions";
import { createFileRoute } from "@tanstack/react-router";
import { useCan } from "@/lib/permissions";
import { toast } from "sonner";
import {
  Building2, MapPin, Leaf, Users, Scale, Droplets, Workflow, Beaker, Bell, Eye, RefreshCw,
  Plus, Trash2, RotateCcw, Save, Undo2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmAction } from "@/components/confirm-action";
import { mockDb } from "@/data/mock-data";
import { useStore, getStoreSnapshot } from "@/lib/store";
import {
  roleLabel, roleDescription, useCurrentRole, type AppRole,
} from "@/lib/permissions";
import { useSyncQueue, retrySync, clearSynced } from "@/lib/sync-queue";
import {
  useOrganization, useFarms, useParcels, useUnits, useAppSettings,
  setOrganization, replaceUnits, setSettings,
  addFarm, addParcel,
  resetSettings, resetAll, DEFAULT_SETTINGS,
  type AppSettings, type Organization,
} from "@/lib/app-config-store";
import type { Farm, Parcel, Unit } from "@/types/domain";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes — Bitácora Café Pro" },
      { name: "description", content: "Configura organización, unidades, alertas y permisos." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const role = useCurrentRole();

  return (
    <>
      <PageHeader
        eyebrow="AJUSTES"
        title="Ajustes"
        subtitle="Organización, unidades, alertas, permisos y sincronización."
        action={
          <div className="flex flex-wrap gap-2">
          <ConfirmAction
            destructive
            title="Restablecer todos los ajustes"
            description="Se restablecen los ajustes locales de este dispositivo (organización, unidades y reglas). Fincas, parcelas y clientes guardados en la nube no se tocan."
            confirmLabel="Restablecer"
            trigger={
              <Button variant="outline" className="h-10 rounded-xl">
                <RotateCcw className="size-4" /> Restablecer todo
              </Button>
            }
            onConfirm={() => { resetAll(); toast.success("Ajustes restablecidos"); }}
          />
          <ConfirmAction
            title="Cargar datos de demostración"
            description="Reemplaza los lotes y registros guardados solo en este dispositivo por un conjunto de ejemplo. No se sube nada a la nube."
            confirmLabel="Cargar demo"
            trigger={<Button variant="outline" className="h-10 rounded-xl">Datos demo</Button>}
            onConfirm={() => { loadDemoData(); toast.success("Datos de demostración cargados en este dispositivo"); }}
          />
          <ConfirmAction
            destructive
            title="Vaciar datos locales"
            description="Borra los lotes y registros guardados solo en este dispositivo para tu usuario."
            confirmLabel="Vaciar"
            trigger={<Button variant="outline" className="h-10 rounded-xl">Vaciar local</Button>}
            onConfirm={() => { resetOperationalData(); toast.success("Datos locales vaciados"); }}
          />
          </div>
        }
      />

      <Tabs defaultValue="org">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="org"><Building2 className="size-4" /> Organización</TabsTrigger>
          <TabsTrigger value="farms"><MapPin className="size-4" /> Fincas</TabsTrigger>
          <TabsTrigger value="parcels"><Leaf className="size-4" /> Parcelas</TabsTrigger>
          <TabsTrigger value="users"><Users className="size-4" /> Usuarios y roles</TabsTrigger>
          <TabsTrigger value="units"><Scale className="size-4" /> Unidades</TabsTrigger>
          <TabsTrigger value="moisture"><Droplets className="size-4" /> Humedad</TabsTrigger>
          <TabsTrigger value="processes"><Workflow className="size-4" /> Procesos</TabsTrigger>
          <TabsTrigger value="variables"><Beaker className="size-4" /> Variables</TabsTrigger>
          <TabsTrigger value="alerts"><Bell className="size-4" /> Alertas</TabsTrigger>
          <TabsTrigger value="public"><Eye className="size-4" /> Trazabilidad pública</TabsTrigger>
          <TabsTrigger value="sync"><RefreshCw className="size-4" /> Sincronización</TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="mt-4"><OrgSection /></TabsContent>
        <TabsContent value="farms" className="mt-4"><FarmsSection /></TabsContent>
        <TabsContent value="parcels" className="mt-4"><ParcelsSection /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersRolesSection currentRole={role} /></TabsContent>
        <TabsContent value="units" className="mt-4"><UnitsSection /></TabsContent>
        <TabsContent value="moisture" className="mt-4"><MoistureSection /></TabsContent>
        <TabsContent value="processes" className="mt-4"><ProcessTemplatesSection /></TabsContent>
        <TabsContent value="variables" className="mt-4"><VariablesSection /></TabsContent>
        <TabsContent value="alerts" className="mt-4"><AlertRulesSection /></TabsContent>
        <TabsContent value="public" className="mt-4"><PublicSection /></TabsContent>
        <TabsContent value="sync" className="mt-4"><SyncSection /></TabsContent>
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

// ───────────── Organización ─────────────

function OrgSection() {
  const org = useOrganization();
  const { draft, setDraft, dirty, reset } = useDraft<Organization>(org);
  return (
    <Card className="p-4 space-y-3">
      <div>
        <Label>Nombre de la organización</Label>
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>País</Label>
          <Input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} />
        </div>
        <div>
          <Label>Región</Label>
          <Input value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
        </div>
      </div>
      <SaveBar
        dirty={dirty}
        onDiscard={reset}
        onSave={() => { setOrganization(draft); toast.success("Organización guardada"); }}
      />
    </Card>
  );
}

// ───────────── Fincas ─────────────

function FarmsSection() {
  const farms = useFarms();
  const { draft, setDraft, dirty, reset } = useDraft<Farm[]>(farms);

  const update = (id: string, patch: Partial<Farm>) =>
    setDraft((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const tryRemove = (f: Farm) => {
    const snap = getStoreSnapshot();
    const lotsUsing = snap.lots.filter((l) => l.farm_id === f.id).length;
    const ticketsUsing = snap.harvestTickets.filter((t) => t.farm_id === f.id).length;
    if (lotsUsing > 0 || ticketsUsing > 0) {
      toast.error(`No se puede borrar "${f.name}": tiene ${lotsUsing} lote(s) y ${ticketsUsing} recibo(s) asociados.`);
      return;
    }
    setDraft((prev) => prev.filter((x) => x.id !== f.id));
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => { const f = addFarm(); toast.success(`Finca creada: ${f.name}`); }}>
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

  const tryRemove = (p: Parcel) => {
    const snap = getStoreSnapshot();
    const lotsUsing = snap.lots.filter((l) => l.parcel_id === p.id).length;
    const ticketsUsing = snap.harvestTickets.filter((t) => t.parcel_id === p.id).length;
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
          onClick={() => { const p = addParcel(farms[0]?.id); if (p) toast.success(`Parcela creada: ${p.name}`); }}
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

function UnitsSection() {
  const units = useUnits();
  const { draft, setDraft, dirty, reset } = useDraft<Unit[]>(units);

  const update = (id: string, patch: Partial<Unit>) =>
    setDraft((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  return (
    <div className="space-y-3">
      <Card className="p-0 divide-y divide-border">
        {draft.map((u) => (
          <div key={u.id} className="p-3 grid grid-cols-1 md:grid-cols-[1fr_120px_140px] gap-2 items-end">
            <div>
              <div className="font-medium text-sm">{u.name} <span className="text-muted-foreground">({u.symbol})</span></div>
              <div className="text-xs text-muted-foreground">{u.notes}</div>
            </div>
            <div>
              <Label className="text-xs">kg por unidad</Label>
              <Input
                type="number" step="0.01"
                value={u.kg_factor ?? ""}
                placeholder={u.kg_factor == null ? "Sin definir" : ""}
                disabled={!u.is_configurable}
                onChange={(e) => update(u.id, { kg_factor: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">litros por unidad</Label>
              <Input
                type="number" step="0.01"
                value={u.liters_factor ?? ""}
                disabled={!u.is_configurable}
                onChange={(e) => update(u.id, { liters_factor: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
          </div>
        ))}
        <div className="p-3 text-xs text-muted-foreground">
          Las unidades del sistema (como kg) no son configurables. Para fanega/cajuela, cada finca define su factor.
        </div>
      </Card>
      <SaveBar
        dirty={dirty}
        onDiscard={reset}
        onSave={() => { replaceUnits(draft); toast.success("Unidades guardadas"); }}
      />
    </div>
  );
}

// ───────────── Humedad ─────────────

function MoistureSection() {
  const settings = useAppSettings();
  const { draft, setDraft, dirty, reset } = useDraft<AppSettings>(settings);
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Mínimo ideal (%)</Label>
          <Input type="number" step="0.1" value={draft.moisture_ideal_min}
            onChange={(e) => setDraft({ ...draft, moisture_ideal_min: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Máximo ideal (%)</Label>
          <Input type="number" step="0.1" value={draft.moisture_ideal_max}
            onChange={(e) => setDraft({ ...draft, moisture_ideal_max: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Margen de aviso (%)</Label>
          <Input type="number" step="0.1" value={draft.moisture_warn_margin}
            onChange={(e) => setDraft({ ...draft, moisture_warn_margin: Number(e.target.value) })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Fuera del rango ideal se genera una alerta de humedad. Por encima del margen, se considera crítico.
      </p>
      <SaveBar
        dirty={dirty}
        onDiscard={reset}
        onSave={() => { setSettings(draft); toast.success("Humedad guardada"); }}
        extra={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDraft({
              ...draft,
              moisture_ideal_min: DEFAULT_SETTINGS.moisture_ideal_min,
              moisture_ideal_max: DEFAULT_SETTINGS.moisture_ideal_max,
              moisture_warn_margin: DEFAULT_SETTINGS.moisture_warn_margin,
            })}
          >
            <RotateCcw className="size-4" /> Valores por defecto
          </Button>
        }
      />
    </Card>
  );
}

// ───────────── Procesos / Variables ─────────────

function ProcessTemplatesSection() {
  return (
    <Card className="p-0 divide-y divide-border">
      {mockDb.processTemplates.map((t) => (
        <div key={t.id} className="p-3 text-sm">
          <div className="font-medium">{t.name}</div>
          <div className="text-xs text-muted-foreground">{t.description ?? "—"}</div>
        </div>
      ))}
    </Card>
  );
}

function VariablesSection() {
  const defs = useStore((s) => s.variableDefinitions);
  return (
    <Card className="p-0 divide-y divide-border">
      {defs.map((v) => (
        <div key={v.id} className="p-3 text-sm">
          <div className="font-medium">{v.name} <span className="text-muted-foreground text-xs">· {v.category}</span></div>
          <div className="text-xs text-muted-foreground">
            {v.unit ?? "—"} · ideal {v.ideal_min ?? "—"}–{v.ideal_max ?? "—"}
            {v.alert_if_missing && " · alerta si falta"}
            {v.alert_if_out_of_range && " · alerta fuera de rango"}
          </div>
        </div>
      ))}
    </Card>
  );
}

// ───────────── Reglas de alertas ─────────────

const ALERT_RULE_GROUPS: { title: string; rules: { key: string; label: string }[] }[] = [
  { title: "Tiempo", rules: [
    { key: "phase_near_max", label: "Fase cerca del máximo" },
    { key: "phase_overdue", label: "Fase fuera de tiempo" },
    { key: "lot_no_movement", label: "Lote sin movimiento" },
    { key: "lot_missing_variable", label: "Lote sin variable requerida" },
    { key: "drying_too_long", label: "Secado más largo de lo esperado" },
  ]},
  { title: "Calidad", rules: [
    { key: "moisture_above", label: "Humedad sobre rango" },
    { key: "moisture_below", label: "Humedad bajo rango" },
    { key: "ph_out_of_range", label: "pH fuera de rango" },
    { key: "temp_out_of_range", label: "Temperatura fuera de rango" },
    { key: "water_activity_high", label: "Actividad de agua alta" },
    { key: "quality_pending", label: "Calidad pendiente" },
  ]},
  { title: "Inventario", rules: [
    { key: "low_inventory", label: "Inventario disponible bajo" },
    { key: "reservation_near_expiry", label: "Reserva por vencer" },
    { key: "reservation_expired", label: "Reserva vencida" },
    { key: "over_reservation", label: "Intento de sobre-reserva" },
    { key: "blocked_for_sale", label: "Café bloqueado para venta" },
  ]},
  { title: "Proceso", rules: [
    { key: "missing_required_variable", label: "Variable requerida faltante" },
    { key: "phase_finished_outside", label: "Fase finalizada fuera de rango" },
    { key: "experimental_deviation", label: "Proceso experimental con alta desviación" },
    { key: "waste_above_avg", label: "Mermas sobre promedio histórico" },
  ]},
];

function AlertRulesSection() {
  const settings = useAppSettings();
  const { draft, setDraft, dirty, reset } = useDraft<AppSettings>(settings);
  return (
    <div className="space-y-4">
      {ALERT_RULE_GROUPS.map((g) => (
        <Card key={g.title} className="p-4">
          <h3 className="font-semibold text-sm mb-3">{g.title}</h3>
          <div className="space-y-2">
            {g.rules.map((r) => (
              <div key={r.key} className="flex items-center justify-between">
                <span className="text-sm">{r.label}</span>
                <Switch
                  checked={draft.alert_rules[r.key] ?? true}
                  onCheckedChange={(v) =>
                    setDraft({ ...draft, alert_rules: { ...draft.alert_rules, [r.key]: v } })
                  }
                />
              </div>
            ))}
          </div>
        </Card>
      ))}
      <SaveBar
        dirty={dirty}
        onDiscard={reset}
        onSave={() => { setSettings(draft); toast.success("Reglas de alertas guardadas"); }}
        extra={
          <Button variant="ghost" size="sm" onClick={() => { resetSettings(); toast.success("Reglas restablecidas"); }}>
            <RotateCcw className="size-4" /> Restablecer reglas
          </Button>
        }
      />
    </div>
  );
}

// ───────────── Trazabilidad pública ─────────────

function PublicSection() {
  const settings = useAppSettings();
  const { draft, setDraft, dirty, reset } = useDraft<AppSettings>(settings);
  const fields: { key: keyof AppSettings["public_default_visible"]; label: string }[] = [
    { key: "availability", label: "Disponibilidad" },
    { key: "moisture", label: "Humedad" },
    { key: "quality", label: "Calidad" },
    { key: "tasting_notes", label: "Notas de cata" },
    { key: "photos", label: "Fotos" },
    { key: "process_details", label: "Detalles del proceso" },
  ];
  return (
    <Card className="p-4 space-y-3">
      <p className="text-xs text-muted-foreground">Valores por defecto para la ficha pública de cada lote.</p>
      {fields.map((f) => (
        <div key={f.key} className="flex items-center justify-between">
          <span className="text-sm">{f.label}</span>
          <Switch
            checked={draft.public_default_visible[f.key]}
            onCheckedChange={(v) =>
              setDraft({ ...draft, public_default_visible: { ...draft.public_default_visible, [f.key]: v } })
            }
          />
        </div>
      ))}
      <SaveBar
        dirty={dirty}
        onDiscard={reset}
        onSave={() => { setSettings(draft); toast.success("Trazabilidad pública guardada"); }}
      />
    </Card>
  );
}

// ───────────── Sincronización ─────────────

function SyncSection() {
  const { items, online } = useSyncQueue();
  const pending = items.filter((i) => i.status === "pending" || i.status === "syncing").length;
  const failed = items.filter((i) => i.status === "failed").length;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Estado de sincronización</div>
            <div className="text-xs text-muted-foreground">
              {online ? "En línea" : "Sin conexión"} · {pending} pendientes · {failed} fallidos
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { clearSynced(); toast.success("Limpieza realizada"); }}>
            Limpiar sincronizados
          </Button>
        </div>
      </Card>

      <Card className="p-0 divide-y divide-border">
        <div className="p-3 text-sm font-semibold">Registros pendientes de sincronizar</div>
        {items.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            No hay registros en cola. Cuando trabajes sin conexión, aparecerán aquí para sincronizarse luego.
          </div>
        ) : (
          items.map((i) => (
            <div key={i.id} className="p-3 grid grid-cols-1 md:grid-cols-[1fr_120px_120px_auto] items-center gap-2 text-sm">
              <div>
                <div className="font-medium">{i.entity} · {i.action}</div>
                <div className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString("es")}</div>
              </div>
              <div className="text-xs uppercase">{i.status}</div>
              <div className="text-xs text-muted-foreground">intentos: {i.attempts}</div>
              <Button size="sm" variant="outline" onClick={() => retrySync(i.id)} disabled={i.status === "syncing"}>
                Reintentar
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
