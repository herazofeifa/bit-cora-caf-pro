import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Award, Plus, ChevronRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createQualitySample,
  updateQualitySampleStatus,
  useQualitySamples,
  useStore,
} from "@/lib/store";
import { sampleStatusLabel, sampleStatusTone } from "@/lib/helpers";
import type { QualitySampleStatus } from "@/types/domain";

export const Route = createFileRoute("/_app/quality")({
  head: () => ({
    meta: [
      { title: "Calidad — Bitácora Café Pro" },
      { name: "description", content: "Catación y control de calidad de cada lote." },
    ],
  }),
  component: QualityPage,
});

const STATUSES: QualitySampleStatus[] = ["pendiente", "aprobado", "bloqueado", "rechazado", "requiere_reproceso"];

const FORM = z.object({
  lot_id: z.string().min(1, "Selecciona un lote"),
  sampled_at: z.string().min(1, "Fecha requerida"),
  cupper: z.string().optional(),
  score: z.string().optional(),
  moisture_pct: z.string().optional(),
  water_activity: z.string().optional(),
  density: z.string().optional(),
  screen_size: z.string().optional(),
  primary_defects: z.string().optional(),
  secondary_defects: z.string().optional(),
  color: z.string().optional(),
  smell: z.string().optional(),
  tasting_notes: z.string().optional(),
  status: z.enum(["pendiente", "aprobado", "bloqueado", "rechazado", "requiere_reproceso"]),
  notes: z.string().optional(),
});

function QualityPage() {
  const samples = useQualitySamples();
  const lots = useStore((s) => s.lots);
  const [open, setOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLot, setFilterLot] = useState<string>("all");

  const sorted = useMemo(
    () =>
      [...samples]
        .filter((s) => filterStatus === "all" || s.status === filterStatus)
        .filter((s) => filterLot === "all" || s.lot_id === filterLot)
        .sort((a, b) => new Date(b.sampled_at).getTime() - new Date(a.sampled_at).getTime()),
    [samples, filterStatus, filterLot],
  );

  const totals = useMemo(() => {
    const by = (st: QualitySampleStatus) => samples.filter((s) => s.status === st).length;
    return {
      pendiente: by("pendiente"),
      aprobado: by("aprobado"),
      bloqueado: by("bloqueado"),
      rechazado: by("rechazado"),
      reproceso: by("requiere_reproceso"),
    };
  }, [samples]);

  const lotName = (id: string) => {
    const l = lots.find((x) => x.id === id);
    return l ? `${l.lot_code} · ${l.friendly_name}` : id;
  };

  return (
    <>
      <PageHeader
        title="Calidad"
        subtitle="Catación, puntajes y notas de tu café."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> Nueva muestra</Button>
            </DialogTrigger>
            <NewSampleDialog onClose={() => setOpen(false)} />
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Stat label="Pendientes" value={totals.pendiente} tone="info" />
        <Stat label="Aprobados" value={totals.aprobado} tone="success" />
        <Stat label="Bloqueados" value={totals.bloqueado} tone="warning" />
        <Stat label="Rechazados" value={totals.rechazado} tone="danger" />
        <Stat label="Reproceso" value={totals.reproceso} tone="warning" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Select value={filterLot} onValueChange={setFilterLot}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los lotes</SelectItem>
            {lots.map((l) => <SelectItem key={l.id} value={l.id}>{l.lot_code} · {l.friendly_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{sampleStatusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={Award} title="Sin muestras todavía" description="Registra una nueva muestra para empezar el control de calidad." />
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => (
            <article key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/lots/$id" params={{ id: s.lot_id }} className="font-semibold hover:underline inline-flex items-center gap-1">
                    {lotName(s.lot_id)} <ChevronRight className="size-4" />
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.sampled_at).toLocaleDateString("es")} · Catador: {s.cupper ?? "—"}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={sampleStatusTone(s.status)}>{sampleStatusLabel[s.status]}</StatusBadge>
                    {s.score != null && <span>Puntaje: <strong>{s.score}</strong></span>}
                    {s.moisture_pct != null && <span>Humedad: {s.moisture_pct}%</span>}
                    {s.water_activity != null && (
                      <span className={s.water_activity > 0.6 ? "text-warning-foreground inline-flex items-center gap-1" : ""}>
                        {s.water_activity > 0.6 && <AlertTriangle className="size-3" />}
                        Aw: {s.water_activity}
                      </span>
                    )}
                    {s.density != null && <span>Densidad: {s.density}</span>}
                    {s.screen_size && <span>Malla: {s.screen_size}</span>}
                    {(s.primary_defects ?? 0) + (s.secondary_defects ?? 0) > 0 && (
                      <span>Defectos: {s.primary_defects ?? 0} pri / {s.secondary_defects ?? 0} sec</span>
                    )}
                  </div>
                  {s.tasting_notes && <p className="mt-2 text-sm">{s.tasting_notes}</p>}
                  {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
                </div>
                <div className="shrink-0">
                  <Select value={s.status} onValueChange={(v) => { updateQualitySampleStatus(s.id, v as QualitySampleStatus); toast.success("Estado actualizado"); }}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((st) => <SelectItem key={st} value={st}>{sampleStatusLabel[st]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" | "info" | "neutral" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      <StatusBadge status={tone} className="mt-2">{label}</StatusBadge>
    </div>
  );
}

function NewSampleDialog({ onClose }: { onClose: () => void }) {
  const lots = useStore((s) => s.lots);
  const [form, setForm] = useState({
    lot_id: "",
    sampled_at: new Date().toISOString().slice(0, 10),
    cupper: "",
    score: "",
    moisture_pct: "",
    water_activity: "",
    density: "",
    screen_size: "",
    primary_defects: "",
    secondary_defects: "",
    color: "",
    smell: "",
    tasting_notes: "",
    status: "pendiente" as QualitySampleStatus,
    notes: "",
  });

  function submit() {
    const parsed = FORM.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    const d = parsed.data;
    const num = (s?: string) => (s && s.trim() !== "" ? Number(s) : null);
    try {
      createQualitySample({
        lot_id: d.lot_id,
        sampled_at: new Date(d.sampled_at).toISOString(),
        cupper: d.cupper || null,
        score: num(d.score),
        moisture_pct: num(d.moisture_pct),
        water_activity: num(d.water_activity),
        density: num(d.density),
        screen_size: d.screen_size || null,
        primary_defects: num(d.primary_defects),
        secondary_defects: num(d.secondary_defects),
        color: d.color || null,
        smell: d.smell || null,
        tasting_notes: d.tasting_notes || null,
        status: d.status,
        notes: d.notes || null,
      });
      toast.success("Muestra registrada");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nueva muestra de calidad</DialogTitle>
        <DialogDescription>Registra catación, defectos y estado de aprobación del lote.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Lote</Label>
            <Select value={form.lot_id} onValueChange={(v) => setForm({ ...form, lot_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {lots.map((l) => <SelectItem key={l.id} value={l.id}>{l.lot_code} · {l.friendly_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha de muestra</Label>
            <Input type="date" value={form.sampled_at} onChange={(e) => setForm({ ...form, sampled_at: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Catador</Label><Input value={form.cupper} onChange={(e) => setForm({ ...form, cupper: e.target.value })} /></div>
          <div><Label>Puntaje (0–100)</Label><Input type="number" step="0.5" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Humedad %</Label><Input type="number" step="0.1" value={form.moisture_pct} onChange={(e) => setForm({ ...form, moisture_pct: e.target.value })} /></div>
          <div><Label>Aw</Label><Input type="number" step="0.01" value={form.water_activity} onChange={(e) => setForm({ ...form, water_activity: e.target.value })} /></div>
          <div><Label>Densidad</Label><Input type="number" step="0.01" value={form.density} onChange={(e) => setForm({ ...form, density: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Malla</Label><Input placeholder="15+, 16…" value={form.screen_size} onChange={(e) => setForm({ ...form, screen_size: e.target.value })} /></div>
          <div><Label>Defectos primarios</Label><Input type="number" value={form.primary_defects} onChange={(e) => setForm({ ...form, primary_defects: e.target.value })} /></div>
          <div><Label>Defectos secundarios</Label><Input type="number" value={form.secondary_defects} onChange={(e) => setForm({ ...form, secondary_defects: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Color</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          <div><Label>Olor</Label><Input value={form.smell} onChange={(e) => setForm({ ...form, smell: e.target.value })} /></div>
        </div>
        <div>
          <Label>Notas de catación</Label>
          <Textarea rows={3} value={form.tasting_notes} onChange={(e) => setForm({ ...form, tasting_notes: e.target.value })} />
        </div>
        <div>
          <Label>Estado</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as QualitySampleStatus })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{sampleStatusLabel[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Aprobado libera el inventario. Bloqueado o rechazado lo bloquea automáticamente.
          </p>
        </div>
        <div>
          <Label>Notas internas</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit}>Registrar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
