import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Play,
  Pause,
  CheckCircle2,
  Droplet,
  Beaker,
  Trash2,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  elapsedMinutes,
  evaluateTimeAlertsForActivePhases,
  pausePhase,
  resumePhase,
  timeStatus,
  useStore,
  type TimeStatus,
} from "@/lib/store";
import { mockDb } from "@/data/mock-data";
import {
  RegisterMoistureDialog,
  RegisterVariableDialog,
  RegisterWasteDialog,
} from "@/components/lot-action-dialogs";
import { FinishPhaseDialog } from "@/components/finish-phase-dialog";
import type { Lot, ProcessPhaseInstance } from "@/types/domain";

export const Route = createFileRoute("/_app/process-control")({
  head: () => ({
    meta: [
      { title: "Control de proceso — Bitácora Café Pro" },
      { name: "description", content: "Sigue cada fase de tus lotes activos en tiempo real." },
    ],
  }),
  component: ProcessControlPage,
});

const GROUPS = [
  { key: "Recibo", match: /recibo/i },
  { key: "Fermentación", match: /fermentaci/i },
  { key: "Secado", match: /secado/i },
  { key: "Reposo", match: /reposo/i },
  { key: "Trilla", match: /trilla/i },
  { key: "Disponible", match: /disponible|oro verde/i },
] as const;

function groupForPhase(name: string): string {
  return GROUPS.find((g) => g.match.test(name))?.key ?? "Otros";
}

function fmtMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 24) return r ? `${h} h ${r} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} d ${rh} h` : `${d} d`;
}

const STATUS_LABEL: Record<TimeStatus, string> = {
  ontime: "A tiempo",
  near: "Cerca del límite",
  overdue: "Atrasado",
  finished_outside: "Finalizado fuera de rango",
};

function ProcessControlPage() {
  const lots = useStore((s) => s.lots);
  const phases = useStore((s) => s.phases);

  useEffect(() => {
    evaluateTimeAlertsForActivePhases();
    const t = setInterval(evaluateTimeAlertsForActivePhases, 60_000);
    return () => clearInterval(t);
  }, []);

  const active = useMemo(() => {
    return lots
      .filter((l) => l.commercial_state !== "vendido")
      .map((lot) => {
        const phase = phases.find((p) => p.id === lot.current_phase_id) ?? null;
        return { lot, phase };
      })
      .filter((x): x is { lot: Lot; phase: ProcessPhaseInstance } => !!x.phase);
  }, [lots, phases]);

  const grouped = useMemo(() => {
    const map = new Map<string, { lot: Lot; phase: ProcessPhaseInstance }[]>();
    for (const g of GROUPS) map.set(g.key, []);
    for (const item of active) {
      const key = groupForPhase(item.phase.name);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [active]);

  if (active.length === 0) {
    return (
      <>
        <PageHeader title="Control de proceso" subtitle="Lotes activos por fase, en tiempo real." />
        <EmptyState
          icon={Activity}
          title="No hay lotes en proceso"
          description="Cuando inicies una fase verás el estado y los tiempos aquí."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Control de proceso" subtitle="Lotes activos por fase, en tiempo real." />

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 snap-x">
        {grouped.map(([group, items]) => (
          <section
            key={group}
            className="snap-start shrink-0 w-[300px] sm:w-[340px] rounded-2xl bg-muted/40 border border-border p-3"
          >
            <header className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">{group}</h2>
              <Badge variant="secondary">{items.length}</Badge>
            </header>
            <div className="space-y-3">
              {items.map(({ lot, phase }) => (
                <LotPhaseCard key={lot.id} lot={lot} phase={phase} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function LotPhaseCard({ lot, phase }: { lot: Lot; phase: ProcessPhaseInstance }) {
  const variableLogs = useStore((s) => s.variableLogs);
  const definitions = useStore((s) => s.variableDefinitions);

  const elapsed = elapsedMinutes(phase);
  const status = timeStatus(phase);
  const isPaused = phase.status === "paused";

  const lastVar = useMemo(
    () =>
      variableLogs
        .filter((v) => v.lot_id === lot.id)
        .sort((a, b) => +new Date(b.measured_at) - +new Date(a.measured_at))[0],
    [variableLogs, lot.id],
  );
  const lastVarDef = lastVar ? definitions.find((d) => d.id === lastVar.variable_id) : null;

  const [varOpen, setVarOpen] = useState(false);
  const [moistureOpen, setMoistureOpen] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  // next phase from template
  const instance = mockDb.processInstances.find((p) => p.id === phase.process_instance_id);
  const tpls = instance?.template_id
    ? mockDb.processTemplatePhases
        .filter((t) => t.template_id === instance.template_id)
        .sort((a, b) => a.order_index - b.order_index)
    : [];
  const currentTplIdx = tpls.findIndex((t) => t.id === phase.template_phase_id);
  const nextPhaseName = currentTplIdx >= 0 ? tpls[currentTplIdx + 1]?.name ?? null : null;

  const statusTone =
    status === "overdue"
      ? "destructive"
      : status === "near"
      ? "warning"
      : status === "finished_outside"
      ? "warning"
      : "secondary";

  return (
    <Card className="bg-card">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to="/lots/$id"
              params={{ id: lot.id }}
              className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
            >
              {lot.lot_code} <ChevronRight className="inline h-3 w-3" />
            </Link>
            <h3 className="font-display font-semibold leading-tight truncate">
              {lot.friendly_name}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {lot.variety} · {lot.process_type}
            </p>
          </div>
          {isPaused && <Badge variant="outline" className="text-[10px]">Pausada</Badge>}
        </div>

        {/* Timer */}
        <div className="rounded-lg bg-muted/40 p-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Transcurrido
            </span>
            <span className="font-semibold tabular-nums">{fmtMinutes(elapsed)}</span>
          </div>
          {phase.expected_minutes != null && (
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Esperado</span>
              <span className="tabular-nums">{fmtMinutes(phase.expected_minutes)}</span>
            </div>
          )}
          <div className="mt-1.5">
            {status === "overdue" ? (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-1" /> {STATUS_LABEL[status]}
              </Badge>
            ) : status === "near" ? (
              <Badge className="text-[10px] bg-warning text-warning-foreground">{STATUS_LABEL[status]}</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">{STATUS_LABEL[status]}</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Droplet className="h-3 w-3" />
            {lot.current_moisture != null ? `${lot.current_moisture}%` : "—"}
          </span>
          <span className="truncate">
            {lastVar && lastVarDef
              ? `${lastVarDef.name}: ${lastVar.value_number ?? lastVar.value_text ?? "—"}${lastVarDef.unit ? ` ${lastVarDef.unit}` : ""}`
              : "Sin variables"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setVarOpen(true)}>
            <Beaker className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setMoistureOpen(true)}>
            <Droplet className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setWasteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex gap-1.5">
          {isPaused ? (
            <Button size="sm" variant="secondary" className="flex-1 h-8" onClick={() => resumePhase(phase.id)}>
              <Play className="h-3.5 w-3.5 mr-1" /> Reanudar
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className="flex-1 h-8" onClick={() => pausePhase(phase.id)}>
              <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
            </Button>
          )}
          <Button size="sm" className="flex-1 h-8" onClick={() => setFinishOpen(true)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Finalizar
          </Button>
        </div>
      </CardContent>

      <RegisterVariableDialog open={varOpen} onOpenChange={setVarOpen} lot={lot} />
      <RegisterMoistureDialog open={moistureOpen} onOpenChange={setMoistureOpen} lot={lot} />
      <RegisterWasteDialog open={wasteOpen} onOpenChange={setWasteOpen} lot={lot} />
      <FinishPhaseDialog open={finishOpen} onOpenChange={setFinishOpen} lot={lot} phase={phase} nextPhaseName={nextPhaseName} />
    </Card>
  );
}
