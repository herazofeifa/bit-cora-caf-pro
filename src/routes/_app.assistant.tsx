import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Sprout,
  PackageOpen,
  Boxes,
  Droplets,
  Gauge,
  ArrowRightLeft,
  Trash2,
  BookmarkCheck,
  Coffee,
  Bell,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logMoisture, useStore } from "@/lib/store";
import { formatKg, physicalStateLabel } from "@/lib/helpers";
import type { Lot } from "@/types/domain";

export const Route = createFileRoute("/_app/assistant")({
  head: () => ({
    meta: [
      { title: "Asistente — Bitácora Café Pro" },
      { name: "description", content: "Te guiamos paso a paso para registrar lo que necesitás." },
    ],
  }),
  component: AssistantPage,
});

interface AssistantTask {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** If set, navigates to that route instead of running an inline wizard. */
  to?: string;
  /** Inline wizard available. */
  inline?: "moisture";
}

const TASKS: AssistantTask[] = [
  { key: "harvest", label: "Registrar cosecha", hint: "Anotá la jornada en la finca.", icon: Sprout, to: "/harvest/new" },
  { key: "intake", label: "Registrar recibo", hint: "Café que entra al beneficio.", icon: PackageOpen, to: "/intake/new" },
  { key: "lot", label: "Crear lote", hint: "Agrupá café para procesarlo junto.", icon: Boxes, to: "/lots" },
  { key: "moisture", label: "Registrar humedad", hint: "Anotá el % de humedad de un lote.", icon: Droplets, inline: "moisture" },
  { key: "variable", label: "Registrar variable", hint: "Temperatura, pH, brix y más.", icon: Gauge, to: "/variables/new" },
  { key: "phase", label: "Mover fase", hint: "Pasá un lote a la siguiente etapa.", icon: ArrowRightLeft, to: "/process-control" },
  { key: "waste", label: "Registrar merma", hint: "Pérdidas o salidas del proceso.", icon: Trash2, to: "/waste" },
  { key: "reserve", label: "Reservar café", hint: "Apartá café para un cliente.", icon: BookmarkCheck, to: "/reservations" },
  { key: "free", label: "Ver café libre", hint: "Lo que podés ofrecer hoy.", icon: Coffee, to: "/free-coffee" },
  { key: "alerts", label: "Ver alertas de hoy", hint: "Lo que pide tu atención.", icon: Bell, to: "/alerts" },
];

function AssistantPage() {
  const [active, setActive] = useState<AssistantTask | null>(null);
  const navigate = useNavigate();

  const handleSelect = (task: AssistantTask) => {
    if (task.inline) {
      setActive(task);
      return;
    }
    if (task.to) navigate({ to: task.to });
  };

  return (
    <>
      <PageHeader
        eyebrow="ASISTENTE" title="¿Qué querés hacer hoy?"
        subtitle="Elegí una opción y te llevo paso a paso."
      />

      {!active && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TASKS.map((t) => (
            <button
              key={t.key}
              onClick={() => handleSelect(t)}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary hover:bg-accent transition min-h-[76px]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <t.icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.hint}</div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
            </button>
          ))}
        </div>
      )}

      {active?.inline === "moisture" && (
        <MoistureWizard onExit={() => setActive(null)} />
      )}

      {!active && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Tip: usá el asistente cuando no sepas por dónde empezar. Si ya conocés el flujo, podés ir directo desde el menú.
        </div>
      )}
    </>
  );
}

// ───────────────────────────────────────── Moisture wizard ─────────────────────────────────────────

function MoistureWizard({ onExit }: { onExit: () => void }) {
  const lots = useStore((s) => s.lots);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [lotId, setLotId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Solo lotes que tiene sentido medir (no vendidos / descartados).
  const candidates = useMemo(
    () =>
      lots
        .filter((l) => l.commercial_state !== "vendido" && l.commercial_state !== "descartado")
        .sort((a, b) => a.lot_code.localeCompare(b.lot_code)),
    [lots],
  );

  const selectedLot = candidates.find((l) => l.id === lotId) ?? null;

  const goNext = () => {
    if (step === 1 && !lotId) {
      toast.warning("Elegí un lote primero");
      return;
    }
    if (step === 2) {
      const num = Number(value.replace(",", "."));
      if (!isFinite(num) || num <= 0 || num > 100) {
        toast.warning("Ingresá una humedad válida (ej. 11.5)");
        return;
      }
      setStep(3);
      return;
    }
    setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4);
  };

  const handleConfirm = () => {
    if (!selectedLot || saving) return;
    const num = Number(value.replace(",", "."));
    setSaving(true);
    try {
      logMoisture({ lot_id: selectedLot.id, moisture_pct: num });
      const msg = buildMoistureMessage(selectedLot, num);
      setSavedMessage(msg);
      setStep(4);
      toast.success("Humedad registrada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Asistente</div>
          <h2 className="text-xl font-semibold">Registrar humedad</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit}>Cerrar</Button>
      </header>

      <Stepper step={step} labels={["Lote", "Humedad", "Confirmar", "Listo"]} />

      <div className="mt-6">
        {step === 1 && (
          <div>
            <h3 className="font-semibold mb-1">1. Seleccioná el lote</h3>
            <p className="text-sm text-muted-foreground mb-3">Elegí el café al que le vas a medir la humedad.</p>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay lotes activos para medir.</p>
            ) : (
              <ul className="space-y-2 max-h-[360px] overflow-auto pr-1">
                {candidates.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setLotId(l.id)}
                      className={
                        "w-full text-left rounded-xl border p-3 transition flex items-center justify-between gap-3 min-h-[60px] " +
                        (lotId === l.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-accent")
                      }
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-muted-foreground">{l.lot_code}</div>
                        <div className="font-medium truncate">{l.friendly_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {physicalStateLabel[l.physical_state] ?? l.physical_state}
                          {l.current_moisture != null && ` · humedad actual ${l.current_moisture}%`}
                        </div>
                      </div>
                      {lotId === l.id && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 2 && selectedLot && (
          <div>
            <h3 className="font-semibold mb-1">2. Ingresá la humedad</h3>
            <p className="text-sm text-muted-foreground mb-3">
              El rango ideal para vender está entre <strong>9%</strong> y <strong>12.5%</strong>.
            </p>
            <Label htmlFor="moisture" className="text-sm">Humedad (%)</Label>
            <Input
              id="moisture"
              inputMode="decimal"
              placeholder="ej. 11.5"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="text-lg h-12 mt-1 max-w-[200px]"
              autoFocus
            />
            <p className="mt-2 text-xs text-muted-foreground">Lote: {selectedLot.friendly_name}</p>
          </div>
        )}

        {step === 3 && selectedLot && (
          <div>
            <h3 className="font-semibold mb-1">3. Confirmá el registro</h3>
            <p className="text-sm text-muted-foreground mb-3">Revisá los datos antes de guardar.</p>
            <div className="rounded-xl border border-border bg-background p-4 space-y-1 text-sm">
              <Row label="Lote" value={`${selectedLot.friendly_name} (${selectedLot.lot_code})`} />
              <Row label="Estado" value={physicalStateLabel[selectedLot.physical_state] ?? selectedLot.physical_state} />
              <Row label="Humedad anterior" value={selectedLot.current_moisture != null ? `${selectedLot.current_moisture}%` : "Sin registro"} />
              <Row label="Humedad nueva" value={`${value}%`} accent />
            </div>
          </div>
        )}

        {step === 4 && selectedLot && (
          <div className="text-center py-4">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold">Humedad registrada</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{savedMessage}</p>
          </div>
        )}
      </div>

      <footer className="mt-6 flex items-center justify-between gap-2">
        {step > 1 && step < 4 ? (
          <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
            <ChevronLeft className="h-4 w-4" /> Atrás
          </Button>
        ) : <span />}

        {step < 3 && (
          <Button onClick={goNext} className="min-w-[140px]">
            Continuar <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        {step === 3 && (
          <Button onClick={handleConfirm} disabled={saving} className="min-w-[160px]">
            {saving ? "Guardando…" : "Guardar humedad"}
          </Button>
        )}
        {step === 4 && (
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onExit}>Volver al asistente</Button>
            <Link to="/lots/$id" params={{ id: selectedLot!.id }}>
              <Button>Ver lote</Button>
            </Link>
          </div>
        )}
      </footer>
    </section>
  );
}

function buildMoistureMessage(lot: Lot, moisture: number): string {
  const inDrying = lot.physical_state === "secado" || lot.physical_state === "pergamino_humedo";
  const ideal = 11; // punto medio del rango
  const diff = +(moisture - ideal).toFixed(1);

  if (moisture > 12.5) {
    if (inDrying) {
      const pts = Math.max(1, Math.round(moisture - 11));
      return `Humedad registrada. El lote sigue en secado. Faltan aproximadamente ${pts} punto${pts === 1 ? "" : "s"} para llegar al rango ideal.`;
    }
    return `Humedad registrada. Está por encima del rango ideal (12.5%). Considerá volver a secado o revisar el almacenamiento.`;
  }
  if (moisture < 9) {
    return `Humedad registrada. Está por debajo del rango ideal (9%). Café muy seco puede perder calidad en taza.`;
  }
  return `Humedad registrada. Está dentro del rango ideal (9–12.5%). Diferencia con el centro: ${diff > 0 ? "+" : ""}${diff} pts.`;
}

// ───────────────────────────────────────── UI atoms ─────────────────────────────────────────

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-2">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold border " +
                (done
                  ? "bg-success text-success-foreground border-success"
                  : current
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border")
              }
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            <span className={"text-xs truncate hidden sm:inline " + (current ? "text-foreground font-medium" : "text-muted-foreground")}>
              {label}
            </span>
            {i < labels.length - 1 && <span className="flex-1 h-px bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-semibold text-primary text-base" : "font-medium"}>{value}</span>
    </div>
  );
}
