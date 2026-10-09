import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadState, Section, SimpleTable, selectCls } from "@/components/ops-ui";
import { ConfirmAction } from "@/components/confirm-action";
import { fmtKg, sel, useOrgQuery } from "@/lib/org-data";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError, requireOrg } from "@/lib/ops-cloud";
import { useCurrentRole } from "@/lib/permissions";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({ meta: [
    { title: "Clientes — Bitácora Café Pro" },
    { name: "description", content: "Clientes de la organización con contacto y kilos reservados y entregados." },
    { property: "og:title", content: "Clientes — Bitácora Café Pro" },
    { property: "og:description", content: "Clientes y su historial de compras." },
  ] }),
  component: CustomersPage,
});

type C = { id: string; name: string; type: string; contact_name: string | null; phone: string | null; email: string | null; country: string | null; notes: string | null };
type R = { customer_id: string; qty_kg: number; status: string };
const empty = { name: "", type: "tostador", contact_name: "", phone: "", email: "", country: "", notes: "" };

function CustomersPage() {
  const role = useCurrentRole(); const can = role === "administrador" || role === "comercial";
  const cs = useOrgQuery<C[]>("cust", (o) => sel("customers", "*", o, "name", true), ["customers"], []);
  const rs = useOrgQuery<R[]>("c-res", (o) => sel("reservations", "customer_id,qty_kg,status", o, "reserved_at"), ["reservations"], []);
  const [f, setF] = useState<typeof empty & { id?: string }>(empty); const [busy, setBusy] = useState(false);
  const kg = (id: string, st: string[]) => rs.data.filter((r) => r.customer_id === id && st.includes(r.status)).reduce((a, r) => a + Number(r.qty_kg), 0);
  async function save() {
    setBusy(true);
    try {
      const row = { name: f.name.trim(), type: f.type, contact_name: f.contact_name || null, phone: f.phone || null, email: f.email || null, country: f.country || null, notes: f.notes || null };
      const { error } = f.id ? await supabase.from("customers").update(row).eq("id", f.id) : await supabase.from("customers").insert({ ...row, organization_id: requireOrg() });
      if (error) throw error; toast.success("Cliente guardado"); setF(empty);
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader eyebrow="CLIENTES" title="Clientes" subtitle="Tostadores, exportadores y compradores locales con sus reservas y entregas." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={`${cs.data.length} clientes`} className="lg:col-span-2">
          <LoadState loading={cs.loading} error={cs.error} empty={!cs.data.length} emptyText="Aún no hay clientes." />
          {cs.data.length > 0 && <SimpleTable head={["Nombre", "Tipo", "Contacto", "País", "Activo", "Entregado", ""]} rows={cs.data.map((c) => [
            c.name, c.type, [c.contact_name, c.phone, c.email].filter(Boolean).join(" · ") || "—", c.country ?? "—",
            fmtKg(kg(c.id, ["reservada", "confirmada"])), fmtKg(kg(c.id, ["entregada"])),
            can ? <span className="flex gap-1"><Button size="sm" variant="outline" onClick={() => setF({ ...empty, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ""])) } as never)}>Editar</Button>
              <ConfirmAction destructive title="Eliminar cliente" description="Solo se puede si no tiene reservas." confirmLabel="Eliminar" trigger={<Button size="sm" variant="ghost">Eliminar</Button>}
                onConfirm={async () => { const { error } = await supabase.from("customers").delete().eq("id", c.id); if (error) toast.error(friendlyError(error)); else toast.success("Cliente eliminado"); }} /></span> : null])} />}
        </Section>
        {can && <Section title={f.id ? "Editar cliente" : "Nuevo cliente"}>
          <div className="grid gap-2">
            <Input placeholder="Nombre" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <select className={selectCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["tostador", "exportador", "importador", "cafeteria", "local", "otro"].map((t) => <option key={t}>{t}</option>)}</select>
            <Input placeholder="Contacto" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} />
            <Input placeholder="Teléfono" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <Input placeholder="Correo" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <Input placeholder="País" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
            <div className="flex gap-2"><Button disabled={busy || !f.name.trim()} onClick={save}>Guardar</Button>{f.id && <Button variant="ghost" onClick={() => setF(empty)}>Cancelar</Button>}</div>
          </div>
        </Section>}
      </div>
    </>
  );
}
