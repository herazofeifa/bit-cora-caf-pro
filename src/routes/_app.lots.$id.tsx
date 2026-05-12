import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Droplet,
  Thermometer,
  TrendingUp,
  MapPin,
  Calendar,
  Coffee,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Beaker,
  History,
  GitBranch,
  QrCode,
  TestTube,
  Trash2,
  ClipboardList,
  Plus,
  Move,
  Boxes,
  Pause,
  Play,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import {
  evaluateTimeAlertsForActivePhases,
  pausePhase,
  resumePhase,
  useStore,
} from "@/lib/store";
import {
  RegisterMoistureDialog,
  RegisterVariableDialog,
  RegisterWasteDialog,
} from "@/components/lot-action-dialogs";
import { FinishPhaseDialog } from "@/components/finish-phase-dialog";
import { mockDb } from "@/data/mock-data";
import {
  calcAvailableKg,
  calcYieldPct,
  commercialStateLabel,
  commercialStateTone,
  formatKg,
  phaseDurationHours,
  physicalStateLabel,
  physicalStateTone,
  qualityStatusLabel,
  qualityTone,
} from "@/lib/helpers";
import type { Lot, ProcessPhaseInstance, ProcessType } from "@/types/domain";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/lots/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Lote ${params.id} — Bitácora Café Pro` },
      { name: "description", content: "Ficha completa del lote de café." },
    ],
  }),
  component: LotDetailPage,
  notFoundComponent: () => (
    <EmptyState
      icon={Boxes}
      title="Lote no encontrado"
      description="El lote que buscas no existe o fue eliminado."
    />
  ),
});

const PROCESS_LABEL: Record<ProcessType, string> = {
  lavado: "Lavado",
  honey: "Honey",
  natural: "Natural",
  anaerobico: "Anaeróbico",
  experimental: "Experimental",
  custom: "Personalizado",
};

function daysBetween(from: string, to: Date = new Date()): number {
  return Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)));
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function LotDetailPage() {
  const { id } = useParams({ from: "/_app/lots/$id" });
  const lot = useStore((s) => s.lots.find((l) => l.id === id));

  if (!lot) {
    return (
      <>
        <BackLink />
        <EmptyState
          icon={Boxes}
          title="Lote no encontrado"
          description="El lote que buscas no existe o fue eliminado."
        />
      </>
    );
  }

  const farm = mockDb.farms.find((f) => f.id === lot.farm_id);
  const parcel = mockDb.parcels.find((p) => p.id === lot.parcel_id);
  const phase = mockDb.processPhaseInstances.find((p) => p.id === lot.current_phase_id);
  const available = calcAvailableKg(lot);

  return (
    <div className="pb-20">
      <BackLink />

      {/* Hero */}
      <div className="mb-6 rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/40 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-medium text-muted-foreground">{lot.lot_code}</span>
              {lot.is_custom_process && (
                <Badge variant="outline" className="text-[10px]">Proceso personalizado</Badge>
              )}
            </div>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold leading-tight">
              {lot.friendly_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lot.variety} · {PROCESS_LABEL[lot.process_type]} · {farm?.name}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <StatusBadge status={physicalStateTone(lot.physical_state)}>
            {physicalStateLabel[lot.physical_state]}
          </StatusBadge>
          <StatusBadge status={commercialStateTone(lot.commercial_state)}>
            {commercialStateLabel[lot.commercial_state]}
          </StatusBadge>
          <StatusBadge status={qualityTone(lot.quality_status)}>
            {qualityStatusLabel[lot.quality_status]}
          </StatusBadge>
        </div>

        <QuickActions />
      </div>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="w-full overflow-x-auto justify-start no-scrollbar h-auto flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="proceso">Proceso</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="reservas">Reservas</TabsTrigger>
          <TabsTrigger value="calidad">Calidad</TabsTrigger>
          <TabsTrigger value="mermas">Mermas</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="trazabilidad">Trazabilidad</TabsTrigger>
          <TabsTrigger value="qr">QR público</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <ResumenTab lot={lot} farmName={farm?.name ?? "—"} parcelName={parcel?.name ?? null} phase={phase ?? null} available={available} />
        </TabsContent>
        <TabsContent value="proceso" className="mt-4">
          <ProcesoTab lot={lot} />
        </TabsContent>
        <TabsContent value="variables" className="mt-4">
          <VariablesTab lot={lot} />
        </TabsContent>
        <TabsContent value="inventario" className="mt-4">
          <InventarioTab lot={lot} available={available} />
        </TabsContent>
        <TabsContent value="reservas" className="mt-4">
          <ReservasTab lot={lot} />
        </TabsContent>
        <TabsContent value="calidad" className="mt-4">
          <CalidadTab lot={lot} />
        </TabsContent>
        <TabsContent value="mermas" className="mt-4">
          <MermasTab lot={lot} />
        </TabsContent>
        <TabsContent value="historial" className="mt-4">
          <HistorialTab lot={lot} />
        </TabsContent>
        <TabsContent value="trazabilidad" className="mt-4">
          <TrazabilidadTab lot={lot} />
        </TabsContent>
        <TabsContent value="qr" className="mt-4">
          <QrTab lot={lot} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/lots"
      className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4 mr-1" /> Volver a lotes
    </Link>
  );
}

function QuickActions() {
  const actions = [
    { label: "Humedad", icon: Droplet },
    { label: "Variable", icon: Beaker },
    { label: "Mover fase", icon: Move },
    { label: "Merma", icon: Trash2 },
    { label: "Reservar", icon: ClipboardList },
    { label: "Dividir", icon: GitBranch },
    { label: "Mezclar", icon: Plus },
    { label: "Ajustar", icon: Package },
    { label: "Ficha pública", icon: QrCode },
  ];
  return (
    <div className="mt-5 -mx-1 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {actions.map((a) => (
        <Button key={a.label} variant="secondary" size="sm" className="shrink-0">
          <a.icon className="h-3.5 w-3.5 mr-1.5" /> {a.label}
        </Button>
      ))}
    </div>
  );
}

// ───────────── Resumen tab ─────────────

function ResumenTab({
  lot,
  farmName,
  parcelName,
  phase,
  available,
}: {
  lot: Lot;
  farmName: string;
  parcelName: string | null;
  phase: ProcessPhaseInstance | null;
  available: number;
}) {
  const daysSinceHarvest = daysBetween(lot.created_at);
  const daysInPhase = phase ? Math.floor(phaseDurationHours(phase) / 24) : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InfoCard title="Origen" icon={MapPin}>
        <Row label="Finca" value={farmName} />
        <Row label="Parcela" value={parcelName ?? "—"} />
        <Row label="Productor" value={lot.producer_name ?? "—"} />
        <Row label="Región" value={lot.region ?? "—"} />
        <Row label="Altitud" value={lot.altitude_m ? `${lot.altitude_m} m` : "—"} />
        <Row label="Variedad" value={lot.variety} />
      </InfoCard>

      <InfoCard title="Proceso" icon={Coffee}>
        <Row label="Tipo" value={PROCESS_LABEL[lot.process_type]} />
        <Row label="Personalizado" value={lot.is_custom_process ? "Sí" : "No"} />
        <Row label="Fase actual" value={phase?.name ?? "—"} />
        <Row label="Días desde cosecha" value={`${daysSinceHarvest} d`} />
        <Row label="Días en fase actual" value={daysInPhase != null ? `${daysInPhase} d` : "—"} />
      </InfoCard>

      <InfoCard title="Estado" icon={CheckCircle2}>
        <Row label="Físico" value={physicalStateLabel[lot.physical_state]} />
        <Row label="Comercial" value={commercialStateLabel[lot.commercial_state]} />
        <Row label="Calidad" value={qualityStatusLabel[lot.quality_status]} />
        <Row label="Humedad" value={lot.current_moisture != null ? `${lot.current_moisture}%` : "—"} />
        <Row label="Ubicación" value={lot.current_location ?? "—"} />
      </InfoCard>

      <InfoCard title="Cantidades" icon={Package}>
        <Row label="Inicial" value={formatKg(lot.qty_initial_kg)} />
        <Row label="Actual" value={formatKg(lot.qty_current_kg)} />
        <Row label="Disponible" value={formatKg(available)} accent="success" />
        <Row label="Reservado" value={formatKg(lot.qty_reserved_kg)} />
        <Row label="Comprometido" value={formatKg(lot.qty_committed_kg)} />
        <Row label="Bloqueado" value={formatKg(lot.qty_blocked_kg)} />
      </InfoCard>
    </div>
  );
}

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Coffee;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: "success" }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-medium ${accent === "success" ? "text-success" : ""}`}>
        {value}
      </span>
    </div>
  );
}

// ───────────── Proceso tab ─────────────

function ProcesoTab({ lot }: { lot: Lot }) {
  const instance = mockDb.processInstances.find((p) => p.id === lot.process_instance_id);
  const allPhases = instance
    ? mockDb.processPhaseInstances.filter((p) => p.process_instance_id === instance.id)
    : [];
  const templatePhases = instance?.template_id
    ? mockDb.processTemplatePhases
        .filter((p) => p.template_id === instance.template_id)
        .sort((a, b) => a.order_index - b.order_index)
    : [];

  // merge: show template phases with status; standalone for custom
  const items =
    templatePhases.length > 0
      ? templatePhases.map((tp) => {
          const inst = allPhases.find((p) => p.template_phase_id === tp.id);
          return {
            name: tp.name,
            expected: tp.expected_duration_hours,
            actual: inst ? phaseDurationHours(inst) : null,
            started_at: inst?.started_at ?? null,
            ended_at: inst?.ended_at ?? null,
            isCurrent: inst && !inst.ended_at,
          };
        })
      : allPhases.map((p) => ({
          name: p.name,
          expected: null as number | null,
          actual: phaseDurationHours(p),
          started_at: p.started_at,
          ended_at: p.ended_at,
          isCurrent: !p.ended_at,
        }));

  if (items.length === 0) {
    return <EmptyState icon={Clock} title="Sin proceso registrado" description="Aún no se ha iniciado el proceso de este lote." />;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ol className="relative border-l-2 border-border ml-3 space-y-6">
          {items.map((item, i) => {
            const status = !item.started_at
              ? "pending"
              : item.ended_at
              ? "done"
              : item.expected && item.actual && item.actual > item.expected
              ? "overdue"
              : item.expected && item.actual && item.actual > item.expected * 0.85
              ? "near"
              : "ontime";

            const dot =
              status === "done"
                ? "bg-success"
                : status === "overdue"
                ? "bg-destructive"
                : status === "near"
                ? "bg-warning"
                : status === "ontime"
                ? "bg-primary"
                : "bg-muted";

            const label =
              status === "done"
                ? "Finalizada"
                : status === "overdue"
                ? "Vencida"
                : status === "near"
                ? "Cerca del límite"
                : status === "ontime"
                ? "En tiempo"
                : "Pendiente";

            return (
              <li key={i} className="ml-6">
                <span
                  className={`absolute -left-[9px] mt-1 h-4 w-4 rounded-full ring-4 ring-background ${dot}`}
                />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-sm">{item.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {item.started_at ? fmtDateTime(item.started_at) : "Aún no iniciada"}
                    </p>
                  </div>
                  <Badge variant={status === "overdue" ? "destructive" : "secondary"} className="text-[10px]">
                    {label}
                  </Badge>
                </div>
                {(item.expected != null || item.actual != null) && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {item.actual != null && (
                      <span>Real: {Math.round(item.actual)} h</span>
                    )}
                    {item.expected != null && (
                      <span> · Esperado: {Math.round(item.expected)} h</span>
                    )}
                  </div>
                )}
                {item.expected && item.actual != null && (
                  <Progress
                    value={Math.min(100, (item.actual / item.expected) * 100)}
                    className="mt-2 h-1.5"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

// ───────────── Variables tab ─────────────

function VariablesTab({ lot }: { lot: Lot }) {
  const moistures = mockDb.moistureLogs
    .filter((m) => m.lot_id === lot.id)
    .sort((a, b) => +new Date(a.measured_at) - +new Date(b.measured_at));
  const variables = mockDb.variableLogs.filter((v) => v.lot_id === lot.id);

  if (moistures.length === 0 && variables.length === 0) {
    return (
      <EmptyState
        icon={Beaker}
        title="Aún sin variables"
        description="Registra humedad, temperatura, pH u otras variables para ver su evolución."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {moistures.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Droplet className="h-4 w-4 text-primary" /> Humedad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moistures.map((m) => ({
                  date: new Date(m.measured_at).toLocaleDateString("es", { day: "2-digit", month: "short" }),
                  value: m.moisture_pct,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" fontSize={10} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={10} stroke="var(--muted-foreground)" />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {moistures.slice(-3).reverse().map((m) => (
                <li key={m.id} className="flex justify-between text-muted-foreground">
                  <span>{fmtDateTime(m.measured_at)}</span>
                  <span className="font-medium text-foreground">{m.moisture_pct}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {variables.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Thermometer className="h-4 w-4 text-primary" /> Variables registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {variables.map((v) => {
                const def = mockDb.variableDefinitions.find((d) => d.id === v.variable_id);
                return (
                  <li key={v.id} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
                    <div>
                      <div className="font-medium">{def?.name ?? "Variable"}</div>
                      <div className="text-xs text-muted-foreground">{fmtDateTime(v.measured_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {v.value_number != null ? `${v.value_number}${def?.unit ? ` ${def.unit}` : ""}` : v.value_text}
                      </div>
                      {v.notes && <div className="text-[10px] text-muted-foreground">{v.notes}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ───────────── Inventario tab ─────────────

function InventarioTab({ lot, available }: { lot: Lot; available: number }) {
  const yieldPct = calcYieldPct(lot.qty_initial_kg, lot.qty_current_kg);
  const items = [
    { label: "Inicial", value: lot.qty_initial_kg, tone: "neutral" as const },
    { label: "Actual", value: lot.qty_current_kg, tone: "info" as const },
    { label: "Bloqueado", value: lot.qty_blocked_kg, tone: "warning" as const },
    { label: "Reservado", value: lot.qty_reserved_kg, tone: "info" as const },
    { label: "Comprometido", value: lot.qty_committed_kg, tone: "warning" as const },
    { label: "Vendido", value: lot.qty_sold_kg, tone: "neutral" as const },
    { label: "Stock seguridad", value: lot.stock_safety_kg, tone: "neutral" as const },
    { label: "Disponible", value: available, tone: "success" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((it) => (
          <Card key={it.label}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{it.label}</div>
              <div className="mt-1 text-lg font-semibold">
                <StatusBadge status={it.tone}>{formatKg(it.value)}</StatusBadge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-display font-semibold">
            {yieldPct != null ? `${yieldPct}%` : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatKg(lot.qty_current_kg)} de {formatKg(lot.qty_initial_kg)} iniciales
          </p>
          <Progress
            value={yieldPct ?? 0}
            className="mt-3 h-2"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────── Reservas tab ─────────────

function ReservasTab({ lot }: { lot: Lot }) {
  const reservations = mockDb.reservations.filter((r) => r.lot_id === lot.id);
  if (reservations.length === 0) {
    return <EmptyState icon={ClipboardList} title="Sin reservas" description="Este lote no tiene reservas activas." />;
  }
  return (
    <div className="space-y-3">
      {reservations.map((r) => {
        const customer = mockDb.customers.find((c) => c.id === r.customer_id);
        return (
          <Card key={r.id}>
            <CardContent className="pt-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{customer?.name ?? "Cliente"}</div>
                <div className="text-xs text-muted-foreground">
                  Reservado el {fmtDate(r.reserved_at)}
                  {r.expires_at && ` · vence ${fmtDate(r.expires_at)}`}
                </div>
                {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatKg(r.qty_kg)}</div>
                <StatusBadge status={r.status === "activa" ? "info" : r.status === "convertida" ? "success" : "neutral"}>
                  {r.status}
                </StatusBadge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ───────────── Calidad tab ─────────────

function CalidadTab({ lot }: { lot: Lot }) {
  const samples = mockDb.qualitySamples.filter((q) => q.lot_id === lot.id);
  if (samples.length === 0) {
    return <EmptyState icon={TestTube} title="Sin muestras" description="Aún no hay catación registrada para este lote." />;
  }
  return (
    <div className="space-y-3">
      {samples.map((s) => (
        <Card key={s.id}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Muestra · {fmtDate(s.sampled_at)}</div>
                <div className="text-xs text-muted-foreground">Catador: {s.cupper ?? "—"}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-semibold">{s.score ?? "—"}</div>
                <StatusBadge status={qualityTone(s.status)}>{qualityStatusLabel[s.status]}</StatusBadge>
              </div>
            </div>
            {s.notes && <p className="mt-2 text-sm">{s.notes}</p>}
            {s.defects && <p className="mt-1 text-xs text-destructive">Defectos: {s.defects}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ───────────── Mermas tab ─────────────

function MermasTab({ lot }: { lot: Lot }) {
  const wastes = mockDb.wasteLogs.filter((w) => w.lot_id === lot.id);
  if (wastes.length === 0) {
    return <EmptyState icon={Trash2} title="Sin mermas" description="No hay pérdidas registradas para este lote." />;
  }
  const total = wastes.reduce((acc, w) => acc + w.qty_kg, 0);
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-4">
          <div className="text-xs text-muted-foreground">Total de mermas</div>
          <div className="text-2xl font-display font-semibold text-destructive">{formatKg(total)}</div>
        </CardContent>
      </Card>
      {wastes.map((w) => (
        <Card key={w.id}>
          <CardContent className="pt-4 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{w.reason}</div>
              <div className="text-xs text-muted-foreground">{fmtDateTime(w.registered_at)}</div>
              {w.notes && <p className="mt-1 text-xs text-muted-foreground">{w.notes}</p>}
            </div>
            <div className="font-semibold text-destructive">{formatKg(w.qty_kg)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ───────────── Historial tab ─────────────

interface TimelineEvent {
  date: string;
  type: string;
  title: string;
  description: string;
  tone: "success" | "info" | "warning" | "danger" | "neutral";
}

function HistorialTab({ lot }: { lot: Lot }) {
  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];
    list.push({
      date: lot.created_at,
      type: "Lote",
      title: "Lote creado",
      description: `${lot.lot_code} · ${lot.friendly_name}`,
      tone: "success",
    });
    if (lot.harvest_ticket_id) {
      const ht = mockDb.harvestTickets.find((h) => h.id === lot.harvest_ticket_id);
      if (ht) {
        list.push({
          date: ht.intake_datetime,
          type: ht.kind === "harvest" ? "Cosecha" : "Recibo",
          title: ht.kind === "harvest" ? "Cosecha registrada" : "Recibo en beneficio",
          description: `${ht.qty_original} ${mockDb.units.find((u) => u.id === ht.uom_original_id)?.symbol ?? ""}${ht.qty_kg ? ` · ${formatKg(ht.qty_kg)}` : " · pendiente kg"}`,
          tone: "info",
        });
      }
    }
    mockDb.processPhaseInstances
      .filter((p) => p.process_instance_id === lot.process_instance_id)
      .forEach((p) => {
        list.push({
          date: p.started_at,
          type: "Fase",
          title: `Inicio: ${p.name}`,
          description: p.notes ?? "",
          tone: "info",
        });
        if (p.ended_at) {
          list.push({
            date: p.ended_at,
            type: "Fase",
            title: `Fin: ${p.name}`,
            description: "",
            tone: "success",
          });
        }
      });
    mockDb.moistureLogs
      .filter((m) => m.lot_id === lot.id)
      .forEach((m) =>
        list.push({
          date: m.measured_at,
          type: "Humedad",
          title: `Humedad ${m.moisture_pct}%`,
          description: m.notes ?? "",
          tone: m.moisture_pct > 13 ? "warning" : "neutral",
        }),
      );
    mockDb.variableLogs
      .filter((v) => v.lot_id === lot.id)
      .forEach((v) => {
        const def = mockDb.variableDefinitions.find((d) => d.id === v.variable_id);
        list.push({
          date: v.measured_at,
          type: "Variable",
          title: `${def?.name ?? "Variable"}: ${v.value_number ?? v.value_text}`,
          description: v.notes ?? "",
          tone: "neutral",
        });
      });
    mockDb.stockMovements
      .filter((s) => s.lot_id === lot.id)
      .forEach((s) =>
        list.push({
          date: s.created_at,
          type: "Inventario",
          title: `${s.movement_type} · ${formatKg(s.qty_kg)}`,
          description: s.reason ?? "",
          tone: s.movement_type === "merma" ? "danger" : "info",
        }),
      );
    mockDb.reservations
      .filter((r) => r.lot_id === lot.id)
      .forEach((r) => {
        const customer = mockDb.customers.find((c) => c.id === r.customer_id);
        list.push({
          date: r.reserved_at,
          type: "Reserva",
          title: `Reserva ${customer?.name ?? ""}`,
          description: `${formatKg(r.qty_kg)}`,
          tone: "info",
        });
      });
    mockDb.qualitySamples
      .filter((q) => q.lot_id === lot.id)
      .forEach((q) =>
        list.push({
          date: q.sampled_at,
          type: "Calidad",
          title: `Catación ${q.score ?? ""}`,
          description: q.notes ?? "",
          tone: q.status === "aprobado" ? "success" : "neutral",
        }),
      );
    mockDb.alerts
      .filter((a) => a.lot_id === lot.id)
      .forEach((a) =>
        list.push({
          date: a.created_at,
          type: "Alerta",
          title: a.title,
          description: a.message,
          tone: a.severity === "danger" ? "danger" : a.severity === "warning" ? "warning" : "info",
        }),
      );
    return list.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [lot]);

  if (events.length === 0) {
    return <EmptyState icon={History} title="Sin historial" description="Aún no hay eventos registrados." />;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ol className="relative border-l-2 border-border ml-3 space-y-5">
          {events.map((e, i) => (
            <li key={i} className="ml-6">
              <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ring-4 ring-background ${
                e.tone === "success" ? "bg-success" :
                e.tone === "danger" ? "bg-destructive" :
                e.tone === "warning" ? "bg-warning" :
                e.tone === "info" ? "bg-primary" : "bg-muted"
              }`} />
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{e.type}</Badge>
                <span className="text-xs text-muted-foreground">
                  <Calendar className="inline h-3 w-3 mr-1" />
                  {fmtDateTime(e.date)}
                </span>
              </div>
              <h4 className="mt-1 font-semibold text-sm">{e.title}</h4>
              {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ───────────── Trazabilidad tab ─────────────

function TrazabilidadTab({ lot }: { lot: Lot }) {
  const lots = useStore((s) => s.lots);
  const parent = lot.parent_lot_id ? lots.find((l) => l.id === lot.parent_lot_id) : null;
  const children = lots.filter((l) => l.parent_lot_id === lot.id);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4 text-primary" /> Árbol de trazabilidad
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {parent ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Lote padre</div>
              <LotChip lot={parent} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tiene lote padre. Es un lote original.</p>
          )}

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Lote actual</div>
            <LotChip lot={lot} highlight />
          </div>

          {children.length > 0 ? (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Lotes hijos ({children.length})
              </div>
              <div className="space-y-2">
                {children.map((c) => (
                  <LotChip key={c.id} lot={c} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tiene divisiones ni mezclas registradas.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LotChip({ lot, highlight }: { lot: Lot; highlight?: boolean }) {
  return (
    <Link
      to="/lots/$id"
      params={{ id: lot.id }}
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition hover:border-primary/50 ${
        highlight ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div>
        <div className="font-mono text-xs text-muted-foreground">{lot.lot_code}</div>
        <div className="font-medium text-sm">{lot.friendly_name}</div>
      </div>
      <div className="text-xs text-muted-foreground">{formatKg(lot.qty_current_kg)}</div>
    </Link>
  );
}

// ───────────── QR público tab ─────────────

function QrTab({ lot }: { lot: Lot }) {
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${lot.lot_code}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4 text-primary" /> Ficha pública del lote
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/40">
          <QrCode className="h-24 w-24 text-muted-foreground" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">URL pública</div>
          <code className="text-sm break-all">{url}</code>
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Próximamente: comparte una ficha pública con la historia del lote para tostadores y consumidores finales.
        </p>
        <Button disabled variant="secondary">
          <AlertTriangle className="h-4 w-4 mr-2" /> Próximamente
        </Button>
      </CardContent>
    </Card>
  );
}
