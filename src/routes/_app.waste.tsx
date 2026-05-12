import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Trash2, Plus, ChevronRight, Camera } from "lucide-react";
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
import { logWaste, useStore } from "@/lib/store";
import { mockDb } from "@/data/mock-data";
import {
  formatKg,
  wasteDestinationLabel,
  wasteTypeLabel,
} from "@/lib/helpers";
import type { WasteDestination, WasteType } from "@/types/domain";

export const Route = createFileRoute("/_app/waste")({
  head: () => ({
    meta: [
      { title: "Mermas — Bitácora Café Pro" },
      { name: "description", content: "Pérdidas y descartes registrados durante el proceso." },
    ],
  }),
  component: WastePage,
});

const FORM = z.object({
  lot_id: z.string().min(1, "Selecciona un lote"),
  waste_type: z.string().min(1),
  qty_kg: z.coerce.number().positive("Cantidad inválida"),
  qty_original: z.string().optional(),
  qty_original_unit: z.string().optional(),
  destination: z.string().min(1),
  reason: z.string().trim().min(1, "Describe la razón"),
  responsible: z.string().optional(),
  notes: z.string().optional(),
  photo_url: z.string().optional(),
  phase_instance_id: z.string().optional(),
});

function WastePage() {
  const wasteLogs = useStore((s) => s.wasteLogs);
  const lots = useStore((s) => s.lots);
  const [open, setOpen] = useState(false);
  const [filterLot, setFilterLot] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = useMemo(() => {
    return wasteLogs.filter((w) => {
      if (filterLot !== "all" && w.lot_id !== filterLot) return false;
      if (filterType !== "all" && w.waste_type !== filterType) return false;
      return true;
    });
  }, [wasteLogs, filterLot, filterType]);

  const totalKg = filtered.reduce((acc, w) => acc + w.qty_kg, 0);

  const lotName = (id: string) => {
    const l = lots.find((x) => x.id === id);
    return l ? `${l.lot_code} · ${l.friendly_name}` : id;
  };

  return (
    <>
      <PageHeader
        title="Mermas"
        subtitle="Lo que se pierde durante el proceso. Registralo para entender tus rendimientos."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" /> Registrar merma</Button>
            </DialogTrigger>
            <NewWasteDialog onClose={() => setOpen(false)} />
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Total registrado" value={formatKg(totalKg)} />
        <Stat label="Registros" value={String(filtered.length)} />
        <Stat label="Lotes con merma" value={String(new Set(filtered.map((w) => w.lot_id)).size)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Select value={filterLot} onValueChange={setFilterLot}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los lotes</SelectItem>
            {lots.map((l) => <SelectItem key={l.id} value={l.id}>{l.lot_code} · {l.friendly_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(wasteTypeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Trash2} title="No hay mermas que coincidan" description="Cambia los filtros o registra una nueva merma." />
      ) : (
        <div className="space-y-2">
          {filtered.map((w) => {
            const phase = mockDb.processPhaseInstances.find((p) => p.id === w.phase_instance_id);
            return (
              <Link
                key={w.id}
                to="/lots/$id"
                params={{ id: w.lot_id }}
                className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary transition"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status="warning">{wasteTypeLabel[w.waste_type]}</StatusBadge>
                    <span className="font-semibold">{formatKg(w.qty_kg)}</span>
                    <span className="text-xs text-muted-foreground">
                      → {wasteDestinationLabel[w.destination]}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">{lotName(w.lot_id)}</div>
                  <div className="mt-1 text-xs text-muted-foreground truncate">
                    {phase ? `${phase.name} · ` : ""}
                    {new Date(w.registered_at).toLocaleDateString("es")} · {w.reason}
                  </div>
                  {w.notes && <p className="mt-1 text-xs text-muted-foreground">{w.notes}</p>}
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

function NewWasteDialog({ onClose }: { onClose: () => void }) {
  const lots = useStore((s) => s.lots);
  const phases = useStore((s) => s.phases);
  const [form, setForm] = useState({
    lot_id: "",
    waste_type: "perdida_secado" as WasteType,
    qty_kg: "",
    qty_original: "",
    qty_original_unit: "",
    destination: "compost" as WasteDestination,
    reason: "",
    responsible: "Don Paco",
    notes: "",
    photo_url: "",
    phase_instance_id: "",
  });

  const lotPhases = phases.filter((p) => {
    if (!form.lot_id) return false;
    const lot = lots.find((l) => l.id === form.lot_id);
    if (!lot) return false;
    const inst = mockDb.processInstances.find((i) => i.id === lot.process_instance_id);
    return inst ? p.process_instance_id === inst.id : false;
  });

  function submit() {
    const parsed = FORM.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    try {
      logWaste({
        lot_id: parsed.data.lot_id,
        waste_type: parsed.data.waste_type as WasteType,
        qty_kg: parsed.data.qty_kg,
        qty_original: parsed.data.qty_original ? Number(parsed.data.qty_original) : null,
        qty_original_unit: parsed.data.qty_original_unit || null,
        destination: parsed.data.destination as WasteDestination,
        reason: parsed.data.reason,
        phase_instance_id: parsed.data.phase_instance_id || null,
        responsible_user_id: parsed.data.responsible || null,
        photo_url: parsed.data.photo_url || null,
        notes: parsed.data.notes || null,
      });
      toast.success("Merma registrada");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Registrar merma</DialogTitle>
        <DialogDescription>Cada registro descuenta inventario y queda en la historia del lote.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Lote</Label>
          <Select value={form.lot_id} onValueChange={(v) => setForm({ ...form, lot_id: v, phase_instance_id: "" })}>
            <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
            <SelectContent>
              {lots.map((l) => <SelectItem key={l.id} value={l.id}>{l.lot_code} · {l.friendly_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {lotPhases.length > 0 && (
          <div>
            <Label>Fase del proceso (opcional)</Label>
            <Select value={form.phase_instance_id} onValueChange={(v) => setForm({ ...form, phase_instance_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sin fase" /></SelectTrigger>
              <SelectContent>
                {lotPhases.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo de merma</Label>
            <Select value={form.waste_type} onValueChange={(v) => setForm({ ...form, waste_type: v as WasteType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(wasteTypeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Destino</Label>
            <Select value={form.destination} onValueChange={(v) => setForm({ ...form, destination: v as WasteDestination })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(wasteDestinationLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Cantidad original</Label>
            <Input type="number" value={form.qty_original} onChange={(e) => setForm({ ...form, qty_original: e.target.value })} />
          </div>
          <div>
            <Label>Unidad</Label>
            <Input placeholder="kg, qq…" value={form.qty_original_unit} onChange={(e) => setForm({ ...form, qty_original_unit: e.target.value })} />
          </div>
          <div>
            <Label>Cantidad (kg)</Label>
            <Input type="number" min="0" step="0.1" value={form.qty_kg} onChange={(e) => setForm({ ...form, qty_kg: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Razón</Label>
          <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Pérdida por secado, defectos en selección…" />
        </div>
        <div>
          <Label>Responsable</Label>
          <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
        </div>
        <div>
          <Label className="flex items-center gap-1"><Camera className="size-3" /> Foto (URL, opcional)</Label>
          <Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
        </div>
        <div>
          <Label>Notas</Label>
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
