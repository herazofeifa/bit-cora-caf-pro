import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BookmarkCheck, Plus, AlertTriangle, CheckCircle2, XCircle, PackageCheck } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/confirm-action";
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
  cancelReservation,
  confirmReservation,
  createReservation,
  deliverReservation,
  evaluateReservationExpirations,
  useStore,
} from "@/lib/store";
import { calcAvailableKg, formatKg, reservationStatusLabel } from "@/lib/helpers";
import { PermissionGate } from "@/components/permission-gate";
import type { Reservation, ReservationStatus } from "@/types/domain";

export const Route = createFileRoute("/_app/reservations")({
  head: () => ({
    meta: [
      { title: "Reservas — Bitácora Café Pro" },
      { name: "description", content: "Café apartado para clientes." },
    ],
  }),
  component: ReservationsPage,
});

const FORM_SCHEMA = z.object({
  lot_id: z.string().min(1, "Selecciona un lote"),
  customer_id: z.string().min(1, "Selecciona un cliente"),
  qty_kg: z.coerce.number().positive("Cantidad inválida"),
  price: z.string().optional(),
  expires_at: z.string().optional(),
  notes: z.string().max(500).optional(),
});

function statusTone(s: ReservationStatus) {
  switch (s) {
    case "reservada":
    case "activa":
      return "info" as const;
    case "confirmada":
      return "success" as const;
    case "entregada":
    case "convertida":
      return "neutral" as const;
    case "vencida":
      return "warning" as const;
    case "cancelada":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function ReservationsPage() {
  const reservations = useStore((s) => s.reservations);
  const customers = useStore((s) => s.customers);
  const lots = useStore((s) => s.lots);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    evaluateReservationExpirations();
  }, [reservations.length]);

  const sorted = useMemo(
    () => [...reservations].sort((a, b) => new Date(b.reserved_at).getTime() - new Date(a.reserved_at).getTime()),
    [reservations],
  );

  const lotName = (id: string) => {
    const l = lots.find((x) => x.id === id);
    return l ? `${l.lot_code} · ${l.friendly_name}` : id;
  };
  const custName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        eyebrow="RESERVAS" title="Reservas"
        subtitle="Café apartado para tus clientes."
        action={
          <PermissionGate permission="reservation.create">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" /> Reservar café</Button>
              </DialogTrigger>
              <NewReservationDialog onClose={() => setOpen(false)} />
            </Dialog>
          </PermissionGate>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState icon={BookmarkCheck} title="Sin reservas todavía" description="Reserva café para tus clientes desde el botón Reservar." />
      ) : (
        <div className="space-y-3">
          {sorted.map((r) => (
            <ReservationRow
              key={r.id}
              r={r}
              lotName={lotName(r.lot_id)}
              customerName={custName(r.customer_id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ReservationRow({ r, lotName, customerName }: { r: Reservation; lotName: string; customerName: string }) {
  const expiringSoon =
    r.expires_at &&
    (r.status === "reservada" || r.status === "activa" || r.status === "confirmada") &&
    new Date(r.expires_at).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 3;

  const isActive = r.status === "reservada" || r.status === "activa" || r.status === "confirmada";

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{customerName}</div>
          <Link to="/lots/$id" params={{ id: r.lot_id }} className="font-semibold hover:underline">
            {lotName}
          </Link>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
            <StatusBadge status={statusTone(r.status)}>{reservationStatusLabel[r.status]}</StatusBadge>
            <span>{formatKg(r.qty_kg)}</span>
            {r.price != null && <span>· {r.price} {r.currency ?? ""}</span>}
            {r.expires_at && (
              <span>· Vence {new Date(r.expires_at).toLocaleDateString("es")}</span>
            )}
            {expiringSoon && (
              <span className="inline-flex items-center gap-1 text-warning-foreground">
                <AlertTriangle className="size-3" /> Por vencer
              </span>
            )}
          </div>
          {r.notes && <p className="mt-2 text-sm text-muted-foreground">{r.notes}</p>}
        </div>
        {isActive && (
          <div className="flex flex-wrap gap-2">
            {r.status !== "confirmada" && (
              <Button size="sm" variant="outline" onClick={() => { confirmReservation(r.id); toast.success("Reserva confirmada"); }}>
                <CheckCircle2 className="size-4" /> Confirmar
              </Button>
            )}
            <ConfirmAction
              title="¿Entregar este café al cliente?"
              description="Vas a registrar la entrega como una venta. Esta acción no se puede deshacer."
              confirmLabel="Sí, entregar"
              onConfirm={() => {
                try { deliverReservation(r.id); toast.success("Entregada y registrada como venta"); }
                catch (e) { toast.error((e as Error).message); }
              }}
              trigger={
                <Button size="sm">
                  <PackageCheck className="size-4" /> Entregar
                </Button>
              }
            />
            <ConfirmAction
              title="¿Cancelar la reserva?"
              description="El café reservado quedará liberado y disponible para vender."
              confirmLabel="Sí, cancelar reserva"
              cancelLabel="Volver"
              destructive
              onConfirm={() => {
                try { cancelReservation(r.id); toast.success("Reserva cancelada, café liberado"); }
                catch (e) { toast.error((e as Error).message); }
              }}
              trigger={
                <Button size="sm" variant="ghost">
                  <XCircle className="size-4" /> Cancelar
                </Button>
              }
            />
          </div>
        )}
      </div>
    </article>
  );
}

function NewReservationDialog({ onClose }: { onClose: () => void }) {
  const lots = useStore((s) => s.lots);
  const customers = useStore((s) => s.customers);
  const [form, setForm] = useState({ lot_id: "", customer_id: "", qty_kg: "", price: "", expires_at: "", notes: "" });

  const selectedLot = lots.find((l) => l.id === form.lot_id);
  const available = selectedLot ? calcAvailableKg(selectedLot) : 0;

  function submit() {
    const parsed = FORM_SCHEMA.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    try {
      createReservation({
        lot_id: parsed.data.lot_id,
        customer_id: parsed.data.customer_id,
        qty_kg: parsed.data.qty_kg,
        price: parsed.data.price ? Number(parsed.data.price) : null,
        currency: "USD",
        expires_at: parsed.data.expires_at ? new Date(parsed.data.expires_at).toISOString() : null,
        notes: parsed.data.notes || null,
      });
      toast.success("Reserva creada");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Reservar café</DialogTitle>
        <DialogDescription>Aparta café para un cliente. Reduce el inventario disponible.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Cliente</Label>
          <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Lote</Label>
          <Select value={form.lot_id} onValueChange={(v) => setForm({ ...form, lot_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
            <SelectContent>
              {lots.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.lot_code} · {l.friendly_name} · {formatKg(calcAvailableKg(l))} libres</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedLot && (
            <p className="mt-1 text-xs text-muted-foreground">Disponible para reservar: {formatKg(available)}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cantidad (kg)</Label>
            <Input type="number" min="0" step="0.1" value={form.qty_kg} onChange={(e) => setForm({ ...form, qty_kg: e.target.value })} />
          </div>
          <div>
            <Label>Precio (opcional)</Label>
            <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Fecha de expiración</Label>
          <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
        </div>
        <div>
          <Label>Notas</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit}>Reservar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
