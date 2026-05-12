import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Users, Plus, Search, Mail, Phone, Globe, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
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
import { createCustomer, deleteCustomer, updateCustomer, useStore } from "@/lib/store";
import { customerTypeLabel } from "@/lib/helpers";
import type { Customer, CustomerType } from "@/types/domain";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({
    meta: [
      { title: "Clientes — Bitácora Café Pro" },
      { name: "description", content: "Tus compradores y su historial." },
    ],
  }),
  component: CustomersPage,
});

const customerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  type: z.enum(["tostador", "exportador", "cafeteria", "distribuidor", "consumidor", "otro"]),
  contact_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email("Email inválido").max(160).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function CustomersPage() {
  const customers = useStore((s) => s.customers);
  const reservations = useStore((s) => s.reservations);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const reservationCount = (id: string) =>
    reservations.filter((r) => r.customer_id === id).length;

  return (
    <>
      <PageHeader
        eyebrow="CLIENTES" title="Clientes"
        subtitle="Las personas y empresas que compran tu café."
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}><Plus className="size-4" /> Nuevo cliente</Button>
            </DialogTrigger>
            <CustomerDialog initial={editing} onClose={() => setOpen(false)} />
          </Dialog>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar cliente, contacto o email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Sin clientes aún" description="Agrega tu primer cliente para empezar a registrar reservas y ventas." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <article key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <StatusBadge status="info" className="mt-1">{customerTypeLabel[c.type] ?? c.type}</StatusBadge>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      try { deleteCustomer(c.id); toast.success("Cliente eliminado."); }
                      catch (e) { toast.error((e as Error).message); }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                {c.contact_name && <Row icon={<Users className="size-3" />} value={c.contact_name} />}
                {c.phone && <Row icon={<Phone className="size-3" />} value={c.phone} />}
                {c.email && <Row icon={<Mail className="size-3" />} value={c.email} />}
                {c.country && <Row icon={<Globe className="size-3" />} value={c.country} />}
              </dl>
              {c.notes && <p className="mt-3 text-xs text-muted-foreground">{c.notes}</p>}
              <div className="mt-3 text-xs text-muted-foreground">
                {reservationCount(c.id)} reserva(s)
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function Row({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function CustomerDialog({ initial, onClose }: { initial: Customer | null; onClose: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: (initial?.type ?? "tostador") as CustomerType,
    contact_name: initial?.contact_name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    country: initial?.country ?? "",
    notes: initial?.notes ?? "",
  });

  function submit() {
    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    const data = parsed.data;
    const payload = {
      name: data.name,
      type: data.type,
      contact_name: data.contact_name || null,
      phone: data.phone || null,
      email: data.email || null,
      country: data.country || null,
      notes: data.notes || null,
    };
    if (initial) {
      updateCustomer(initial.id, payload);
      toast.success("Cliente actualizado");
    } else {
      createCustomer(payload);
      toast.success("Cliente creado");
    }
    onClose();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        <DialogDescription>Datos básicos para identificar al comprador.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Nombre</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CustomerType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(customerTypeLabel).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Contacto</Label>
            <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </div>
          <div>
            <Label>WhatsApp / Teléfono</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>País</Label>
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Notas</Label>
          <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit}>{initial ? "Guardar" : "Crear"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
