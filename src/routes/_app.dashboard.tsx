import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Coffee,
  Droplets,
  Flame,
  Lock,
  Package,
  Sprout,
  Sun,
  Trash2,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { EmptyState } from "@/components/empty-state";
import { ActionCard } from "@/components/action-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

import { mockDb } from "@/data/mock-data";
import {
  calcAvailableKg,
  commercialStateLabel,
  formatKg,
  phaseDurationDays,
  physicalStateLabel,
} from "@/lib/helpers";
import type { PhysicalState } from "@/types/domain";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Inicio — Bitácora Café Pro" },
      { name: "description", content: "Resumen del día: qué requiere atención, inventario y café disponible." },
    ],
  }),
  component: DashboardPage,
});

const PHYSICAL_ORDER: PhysicalState[] = [
  "cereza",
  "fermentacion",
  "secado",
  "pergamino_humedo",
  "pergamino_seco",
  "trillado",
  "verde",
  "tostado",
];

const PHASE_GROUPS: { key: string; label: string; match: RegExp; icon: typeof Sprout }[] = [
  { key: "recibo", label: "Recibo", match: /recibo|selección/i, icon: Package },
  { key: "ferm", label: "Fermentación", match: /ferment/i, icon: Activity },
  { key: "secado", label: "Secado", match: /secado/i, icon: Sun },
  { key: "reposo", label: "Reposo", match: /reposo/i, icon: Coffee },
  { key: "trilla", label: "Trilla", match: /trill/i, icon: Boxes },
];

function DashboardPage() {
  const { lots, reservations, customers, alerts, processPhaseInstances, processInstances, harvestTickets } = mockDb;
  const org = mockDb.organizations[0];

  // ───── Metrics ─────
  const totals = useMemo(() => {
    const active = lots.filter((l) => l.commercial_state !== "vendido");
    const inDrying = lots.filter((l) => l.physical_state === "secado");
    const readyToRest = lots.filter((l) => l.physical_state === "pergamino_seco");
    const free = lots.reduce((s, l) => s + calcAvailableKg(l), 0);
    const reserved = lots.reduce((s, l) => s + l.qty_reserved_kg, 0);
    const committed = lots.reduce((s, l) => s + l.qty_committed_kg, 0);
    const blocked = lots.reduce((s, l) => s + l.qty_blocked_kg, 0);
    const waste = mockDb.wasteLogs.reduce((s, w) => s + w.qty_kg, 0);
    const expiringSoon = reservations.filter((r) => {
      if (r.status !== "activa" || !r.expires_at) return false;
      const days = (new Date(r.expires_at).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 30;
    }).length;
    const atRisk = alerts.filter((a) => a.status === "open" && (a.severity === "warning" || a.severity === "danger")).length;

    return { activeCount: active.length, atRisk, inDryingCount: inDrying.length, readyCount: readyToRest.length, free, reserved, committed, blocked, waste, expiringSoon };
  }, [lots, reservations, alerts]);

  // ───── Inventory by physical state ─────
  const inventoryByState = useMemo(() => {
    const acc = new Map<PhysicalState, number>();
    PHYSICAL_ORDER.forEach((s) => acc.set(s, 0));
    lots.forEach((l) => acc.set(l.physical_state, (acc.get(l.physical_state) ?? 0) + l.qty_current_kg));
    const wasteKg = mockDb.wasteLogs.reduce((s, w) => s + w.qty_kg, 0);
    const items = Array.from(acc.entries())
      .filter(([, kg]) => kg > 0)
      .map(([state, kg]) => ({ key: state, label: physicalStateLabel[state], kg }));
    if (wasteKg > 0) items.push({ key: "merma" as never, label: "Merma / descarte", kg: wasteKg });
    return items;
  }, [lots]);

  const totalInventoryKg = inventoryByState.reduce((s, i) => s + i.kg, 0);

  // ───── Phase overview ─────
  const phaseGroups = useMemo(() => {
    const groups: Record<string, typeof lots> = { recibo: [], ferm: [], secado: [], reposo: [], trilla: [], disponible: [] };
    lots.forEach((lot) => {
      if (lot.commercial_state === "disponible") {
        groups.disponible.push(lot);
        return;
      }
      const phase = processPhaseInstances.find((p) => p.id === lot.current_phase_id);
      if (!phase) {
        groups.recibo.push(lot);
        return;
      }
      const match = PHASE_GROUPS.find((g) => g.match.test(phase.name));
      if (match) groups[match.key].push(lot);
      else groups.recibo.push(lot);
    });
    return groups;
  }, [lots, processPhaseInstances]);

  // ───── Available to negotiate ─────
  const available = useMemo(
    () =>
      lots
        .map((l) => ({ lot: l, available: calcAvailableKg(l) }))
        .filter((x) => x.available > 0 && x.lot.commercial_state !== "no_disponible")
        .sort((a, b) => b.available - a.available)
        .slice(0, 5),
    [lots],
  );

  // ───── Action items ─────
  const actions = useMemo(() => {
    const items: {
      key: string;
      severity: "normal" | "warning" | "critical";
      lotCode?: string;
      title: string;
      description?: string;
      icon: typeof Sprout;
      buttons: { label: string; onClick: () => void; variant?: "default" | "outline" | "secondary" }[];
    }[] = [];

    // Lot 1: humedad alta en secado
    const lot1 = lots.find((l) => l.lot_code === "NAT-2026-001");
    if (lot1 && lot1.current_moisture && lot1.current_moisture > 13) {
      const phase = processPhaseInstances.find((p) => p.id === lot1.current_phase_id);
      const days = phase ? Math.floor(phaseDurationDays(phase)) : null;
      items.push({
        key: "humedad-1",
        severity: "warning",
        lotCode: lot1.lot_code,
        icon: Droplets,
        title: `Registrar humedad del lote ${lot1.friendly_name}`,
        description: `Humedad actual ${lot1.current_moisture}%${days ? ` · día ${days} de secado` : ""}.`,
        buttons: [
          { label: "Registrar humedad", onClick: () => toast("Registrar humedad", { description: "Próximamente" }) },
          { label: "Ver lote", variant: "outline", onClick: () => toast("Ver lote", { description: lot1.lot_code }) },
        ],
      });
    }

    // Lot 4: fermentación a punto de cerrar
    const lot4 = lots.find((l) => l.lot_code === "ANA-2026-004");
    if (lot4) {
      const phase = processPhaseInstances.find((p) => p.id === lot4.current_phase_id);
      const hours = phase ? Math.floor(phaseDurationDays(phase) * 24) : null;
      items.push({
        key: "ferm-4",
        severity: "critical",
        lotCode: lot4.lot_code,
        icon: Activity,
        title: `Finalizar fermentación del lote ${lot4.friendly_name}`,
        description: hours ? `Lleva ${hours} h en fermentación anaeróbica. Revisar pH y mover fase.` : "Revisar fermentación.",
        buttons: [
          { label: "Mover fase", onClick: () => toast("Mover fase", { description: "Próximamente" }) },
          { label: "Posponer", variant: "outline", onClick: () => toast("Pospuesto", { description: "Te recordaremos mañana" }) },
        ],
      });
    }

    // Lot 2: reserva por confirmar
    const lot2 = lots.find((l) => l.lot_code === "HNY-2026-002");
    const res = reservations.find((r) => r.lot_id === lot2?.id);
    const cust = customers.find((c) => c.id === res?.customer_id);
    if (lot2 && res && cust) {
      items.push({
        key: "res-2",
        severity: "normal",
        lotCode: lot2.lot_code,
        icon: BookmarkCheck,
        title: `Confirmar reserva de ${cust.name}`,
        description: `${formatKg(res.qty_kg)} reservados de ${lot2.friendly_name}.`,
        buttons: [
          { label: "Ver reserva", onClick: () => toast("Ver reserva", { description: cust.name }) },
          { label: "Posponer", variant: "outline", onClick: () => toast("Pospuesto") },
        ],
      });
    }

    // Lot 3: listo para negociar
    const lot3 = lots.find((l) => l.lot_code === "LAV-2026-003");
    if (lot3 && lot3.commercial_state === "disponible") {
      items.push({
        key: "neg-3",
        severity: "normal",
        lotCode: lot3.lot_code,
        icon: CheckCircle2,
        title: `Lote ${lot3.friendly_name} está listo para negociar`,
        description: `${formatKg(calcAvailableKg(lot3))} de ${lot3.variety} disponibles.`,
        buttons: [
          { label: "Ver lote", onClick: () => toast("Ver lote", { description: lot3.lot_code }) },
        ],
      });
    }

    // Pesaje pendiente
    const pending = harvestTickets.find((h) => h.conversion_basis === "pending");
    if (pending) {
      items.push({
        key: "pesaje",
        severity: "warning",
        icon: AlertTriangle,
        title: `Pesaje pendiente del recibo del ${new Date(pending.harvest_date).toLocaleDateString("es")}`,
        description: `${pending.qty_original} fanega(s) sin confirmar kg. Configura el factor de fanega.`,
        buttons: [
          { label: "Confirmar peso", onClick: () => toast("Confirmar peso", { description: "Próximamente" }) },
        ],
      });
    }

    return items;
  }, [lots, reservations, customers, processPhaseInstances, harvestTickets]);

  const greeting = greet();
  const season = harvestSeason();

  const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

  return (
    <>
      {/* 1. Header */}
      <PageHeader
        title={`${greeting}, ${org.name.split(" ").slice(-1)[0]}`}
        subtitle={`${org.name} · ${org.region ?? org.country} · Cosecha ${season}`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-8">
        <QuickStat label="Lotes activos" value={totals.activeCount} />
        <QuickStat label="En riesgo" value={totals.atRisk} tone={totals.atRisk > 0 ? "warning" : undefined} />
        <QuickStat label="En secado" value={totals.inDryingCount} />
        <QuickStat label="Disponibles" value={available.length} tone="success" />
      </div>

      {/* 2. Atención hoy */}
      <SectionTitle
        title="Qué requiere atención hoy"
        subtitle="Acciones para mantener tus lotes en buen estado."
      />
      {actions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 mb-10">
          {actions.map((a) => (
            <ActionCard
              key={a.key}
              icon={a.icon}
              lotCode={a.lotCode}
              title={a.title}
              description={a.description}
              severity={a.severity}
              actions={a.buttons.map((b) => (
                <Button
                  key={b.label}
                  size="sm"
                  variant={b.variant ?? "default"}
                  onClick={b.onClick}
                  className="rounded-full"
                >
                  {b.label}
                </Button>
              ))}
            />
          ))}
        </div>
      ) : (
        <div className="mb-10">
          <EmptyState
            icon={CheckCircle2}
            title="Todo al día"
            description="Ningún lote requiere atención inmediata. Buen trabajo."
          />
        </div>
      )}

      {/* 3. KPIs */}
      <SectionTitle title="Indicadores" subtitle="Resumen rápido del estado de tu beneficio." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <MetricCard icon={Boxes} label="Lotes activos" value={String(totals.activeCount)} />
        <MetricCard icon={AlertTriangle} label="Lotes en riesgo" value={String(totals.atRisk)} hint="Alertas abiertas" />
        <MetricCard icon={Sun} label="Café en secado" value={String(totals.inDryingCount)} hint="lotes" />
        <MetricCard icon={Coffee} label="Listo para reposo" value={String(totals.readyCount)} hint="lotes" />
        <MetricCard icon={Warehouse} label="Inventario libre" value={formatKg(totals.free)} />
        <MetricCard icon={BookmarkCheck} label="Reservado" value={formatKg(totals.reserved)} />
        <MetricCard icon={Package} label="Comprometido" value={formatKg(totals.committed)} />
        <MetricCard icon={Lock} label="Bloqueado" value={formatKg(totals.blocked)} />
        <MetricCard icon={Trash2} label="Merma acumulada" value={formatKg(totals.waste)} />
        <MetricCard icon={CalendarClock} label="Reservas por vencer" value={String(totals.expiringSoon)} hint="próximos 30 días" />
      </div>

      {/* 4. Inventory summary */}
      <SectionTitle title="Inventario por estado" subtitle="Cómo está distribuido tu café hoy." />
      {totalInventoryKg > 0 ? (
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 mb-10">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft min-h-[240px]">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={inventoryByState}
                  dataKey="kg"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={90}
                  stroke="var(--card)"
                  strokeWidth={3}
                >
                  {inventoryByState.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)" }}
                  formatter={(v: number) => formatKg(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2 content-start">
            {inventoryByState.map((item, i) => {
              const pct = totalInventoryKg ? Math.round((item.kg / totalInventoryKg) * 100) : 0;
              return (
                <li
                  key={item.key}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: chartColors[i % chartColors.length] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{formatKg(item.kg)} · {pct}%</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mb-10">
          <EmptyState icon={Warehouse} title="Sin inventario aún" description="Cuando registres lotes, los verás aquí por estado." />
        </div>
      )}

      {/* 5. Process status overview */}
      <SectionTitle title="Lotes por fase" subtitle="Dónde está cada lote en este momento." />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {[
          ...PHASE_GROUPS.map((g) => ({ key: g.key, label: g.label, icon: g.icon, lots: phaseGroups[g.key] })),
          { key: "disponible", label: "Disponible", icon: CheckCircle2, lots: phaseGroups.disponible },
        ].map((g) => (
          <div key={g.key} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{g.label}</span>
              <g.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{g.lots.length}</p>
            <ul className="mt-2 space-y-0.5">
              {g.lots.slice(0, 3).map((l) => (
                <li key={l.id} className="font-mono text-[11px] text-muted-foreground truncate">
                  {l.lot_code}
                </li>
              ))}
              {g.lots.length === 0 && (
                <li className="text-[11px] text-muted-foreground/70 italic">Sin lotes</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      {/* 6. Available to negotiate */}
      <SectionTitle
        title="Café disponible para negociar"
        subtitle="Lotes con inventario libre, listos para conversar con clientes."
      />
      {available.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map(({ lot, available }) => (
            <div key={lot.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-muted-foreground">{lot.lot_code}</p>
                  <h3 className="text-base font-semibold text-foreground leading-tight">{lot.friendly_name}</h3>
                </div>
                <StatusBadge status={lot.quality_status === "aprobado" ? "success" : "neutral"}>
                  {lot.quality_status === "aprobado" ? "Aprobado" : "Sin evaluar"}
                </StatusBadge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {lot.variety} · {processLabel(lot.process_type)}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <Stat label="Disponible" value={formatKg(available)} accent />
                <Stat label="Humedad" value={lot.current_moisture != null ? `${lot.current_moisture}%` : "—"} />
                <Stat label="Estado" value={commercialStateLabel[lot.commercial_state]} />
                <Stat label="Origen" value={lot.region ?? "—"} />
              </div>
              <Button
                variant="outline"
                className="mt-auto rounded-full"
                onClick={() => toast("Ver detalle", { description: lot.lot_code })}
              >
                Ver detalle <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Flame}
          title="Aún no hay café disponible"
          description="Cuando termines de procesar lotes, podrás ofrecerlos aquí."
        />
      )}
    </>
  );
}

// ───────── Pieces ─────────

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function QuickStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning-foreground"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <div className="rounded-2xl bg-secondary/60 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-secondary/50 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function processLabel(p: string) {
  const map: Record<string, string> = {
    lavado: "Lavado",
    honey: "Honey",
    natural: "Natural",
    anaerobico: "Anaeróbico",
    experimental: "Experimental",
    custom: "Personalizado",
  };
  return map[p] ?? p;
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function harvestSeason() {
  const now = new Date();
  const y = now.getFullYear();
  // Northern coffee belt typical season Oct–May
  return now.getMonth() >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
