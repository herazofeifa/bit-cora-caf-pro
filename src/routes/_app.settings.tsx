import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Building2, MapPin, Leaf, Users, Scale, Droplets, Workflow, Beaker, Bell, Eye, RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockDb } from "@/data/mock-data";
import { useStore } from "@/lib/store";
import {
  roleLabel, roleDescription, useCurrentRole, setCurrentRole, type AppRole,
} from "@/lib/permissions";
import { useSyncQueue, retrySync, clearSynced } from "@/lib/sync-queue";
import {
  useOrganization, useFarms, useParcels, useUnits, useAppSettings,
  updateOrganization, updateFarm, updateParcel, updateUnit, updateSettings,
  type AppSettings,
} from "@/lib/app-config-store";

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
  const settings = useAppSettings();

  return (
    <>
      <PageHeader eyebrow="AJUSTES" title="Ajustes" subtitle="Organización, unidades, alertas, permisos y sincronización." />

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
        <TabsContent value="moisture" className="mt-4"><MoistureSection settings={settings} /></TabsContent>
        <TabsContent value="processes" className="mt-4"><ProcessTemplatesSection /></TabsContent>
        <TabsContent value="variables" className="mt-4"><VariablesSection /></TabsContent>
        <TabsContent value="alerts" className="mt-4"><AlertRulesSection settings={settings} /></TabsContent>
        <TabsContent value="public" className="mt-4"><PublicSection settings={settings} /></TabsContent>
        <TabsContent value="sync" className="mt-4"><SyncSection /></TabsContent>
      </Tabs>
    </>
  );
}

function OrgSection() {
  const org = useOrganization();
  return (
    <Card className="p-4 space-y-3">
      <div>
        <Label>Nombre de la organización</Label>
        <Input value={org.name} onChange={(e) => updateOrganization({ name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>País</Label>
          <Input value={org.country} onChange={(e) => updateOrganization({ country: e.target.value })} />
        </div>
        <div>
          <Label>Región</Label>
          <Input value={org.region} onChange={(e) => updateOrganization({ region: e.target.value })} />
        </div>
      </div>
      <div>
        <Button onClick={() => toast.success("Organización guardada")}>Guardar</Button>
      </div>
    </Card>
  );
}

function FarmsSection() {
  const farms = useFarms();
  return (
    <Card className="p-0 divide-y divide-border">
      {farms.map((f) => (
        <div key={f.id} className="p-3 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_120px_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input value={f.name} onChange={(e) => updateFarm(f.id, { name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Región</Label>
            <Input value={f.region ?? ""} onChange={(e) => updateFarm(f.id, { region: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">País</Label>
            <Input value={f.country ?? ""} onChange={(e) => updateFarm(f.id, { country: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Altitud (msnm)</Label>
            <Input
              type="number"
              value={f.altitude_m ?? ""}
              onChange={(e) => updateFarm(f.id, { altitude_m: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success(`${f.name}: guardada`)}>Guardar</Button>
        </div>
      ))}
    </Card>
  );
}

function ParcelsSection() {
  const parcels = useParcels();
  const farms = useFarms();
  return (
    <Card className="p-0 divide-y divide-border">
      {parcels.map((p) => {
        const farm = farms.find((f) => f.id === p.farm_id);
        return (
          <div key={p.id} className="p-3 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_120px_120px_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Nombre ({farm?.name ?? "—"})</Label>
              <Input value={p.name} onChange={(e) => updateParcel(p.id, { name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Variedad</Label>
              <Input value={p.variety ?? ""} onChange={(e) => updateParcel(p.id, { variety: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Área (ha)</Label>
              <Input
                type="number" step="0.1"
                value={p.area_ha ?? ""}
                onChange={(e) => updateParcel(p.id, { area_ha: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Altitud</Label>
              <Input
                type="number"
                value={p.altitude_m ?? ""}
                onChange={(e) => updateParcel(p.id, { altitude_m: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => toast.success(`${p.name}: guardada`)}>Guardar</Button>
          </div>
        );
      })}
    </Card>
  );
}

function UsersRolesSection({ currentRole }: { currentRole: AppRole }) {
  const roles: AppRole[] = ["administrador", "encargado_beneficio", "productor", "comercial", "consulta"];
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Label>Rol activo (modo demo)</Label>
        <p className="text-xs text-muted-foreground mb-2">Cambia el rol para ver cómo se adapta la interfaz y los permisos.</p>
        <Select value={currentRole} onValueChange={(v) => { setCurrentRole(v as AppRole); toast.success(`Rol: ${roleLabel[v as AppRole]}`); }}>
          <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {roles.map((r) => <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>)}
          </SelectContent>
        </Select>
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

function UnitsSection() {
  const units = useUnits();
  return (
    <Card className="p-0 divide-y divide-border">
      {units.map((u) => (
        <div key={u.id} className="p-3 grid grid-cols-1 md:grid-cols-[1fr_120px_140px_auto] gap-2 items-end">
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
              onChange={(e) => updateUnit(u.id, { kg_factor: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">litros por unidad</Label>
            <Input
              type="number" step="0.01"
              value={u.liters_factor ?? ""}
              disabled={!u.is_configurable}
              onChange={(e) => updateUnit(u.id, { liters_factor: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success(`${u.name}: factor actualizado`)}>Guardar</Button>
        </div>
      ))}
      <div className="p-3 text-xs text-muted-foreground">
        La <strong>fanega</strong> permanece configurable: cada finca define cuántos kg representan una fanega según su interpretación local.
      </div>
    </Card>
  );
}

function MoistureSection({ settings }: { settings: AppSettings }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Mínimo ideal (%)</Label>
          <Input type="number" step="0.1" value={settings.moisture_ideal_min}
            onChange={(e) => updateSettings({ moisture_ideal_min: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Máximo ideal (%)</Label>
          <Input type="number" step="0.1" value={settings.moisture_ideal_max}
            onChange={(e) => updateSettings({ moisture_ideal_max: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Margen de aviso (%)</Label>
          <Input type="number" step="0.1" value={settings.moisture_warn_margin}
            onChange={(e) => updateSettings({ moisture_warn_margin: Number(e.target.value) })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Fuera del rango ideal se genera una alerta de humedad. Por encima del margen, se considera crítico.
      </p>
    </Card>
  );
}

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

function AlertRulesSection({ settings }: { settings: AppSettings }) {
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
                  checked={settings.alert_rules[r.key] ?? true}
                  onCheckedChange={(v) =>
                    updateSettings({ alert_rules: { ...settings.alert_rules, [r.key]: v } })
                  }
                />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function PublicSection({ settings }: { settings: AppSettings }) {
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
            checked={settings.public_default_visible[f.key]}
            onCheckedChange={(v) =>
              updateSettings({ public_default_visible: { ...settings.public_default_visible, [f.key]: v } })
            }
          />
        </div>
      ))}
    </Card>
  );
}

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
