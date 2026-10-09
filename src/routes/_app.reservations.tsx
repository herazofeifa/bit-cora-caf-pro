import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Kpi, LoadState, LotLink, Section, SimpleTable, resLabel, selectCls, type Lot } from "@/components/ops-ui";
import { fmtDay, fmtKg, sel, useOrgQuery } from "@/lib/org-data";
import { cancelReservation, confirmReservation, createReservationFull, deliverReservation, friendlyError, newOpKey, setReservationTerms } from "@/lib/ops-cloud";
import { useCurrentRole } from "@/lib/permissions";

type Search = { lot?: string; estado?: string };
export const Route = createFileRoute("/_app/reservations")({
  validateSearch: (s: Record<string, unknown>): Search => ({ lot: typeof s.lot === "string" ? s.lot : undefined, estado: typeof s.estado === "string" ? s.estado : undefined }),
  head: () => ({ meta: [
    { title: "Reservas — Bitácora Café Pro" },
    { name: "description", content: "Reservas con precio, moneda, unidad, vencimiento, fecha de entrega pactada y condiciones." },
    { property: "og:title", content: "Reservas — Bitácora Café Pro" },
    { property: "og:description", content: "Reservas y entregas de café." },
  ] }),
  component: ReservationsPage,
});

type R = { id: string; lot_id: string; customer_id: string; qty_kg: number; price: number | null; currency: string | null; price_unit: string; status: string;
  reserved_at: string; expires_at: string | null; agreed_delivery_date: string | null; conditions: string | null; delivered_at: string | null; notes: string | null };

function ReservationsPage() {
  const search = Route.useSearch(); const role = useCurrentRole(); const can = role === "administrador" || role === "comercial";
  const rs = useOrgQuery<R[]>("res", (o) => sel("reservations", "*", o, "reserved_at"), ["reservations"], []);
  const lots = useOrgQuery<Lot[]>("r-l", (o) => sel("lots", "*", o), ["lots"], []);
  const cs = useOrgQuery<{ id: string; name: string }[]>("r-c", (o) => sel("customers", "id,name", o, "name", true), ["customers"], []);
  const [estado, setEstado] = useState(search.estado ?? "");
  const [f, setF] = useState({ lot: search.lot ?? "", customer: "", qty: "", price: "", currency: "USD", unit: "kg", expires: "", delivery: "", conditions: "" });
  const [busy, setBusy] = useState(false);
  const lot = (id: string) => lots.data.find((l) => l.id === id); const cust = (id: string) => cs.data.find((c) => c.id === id)?.name ?? "—";
  const sellable = lots.data.filter((l) => l.sale_released && l.qty_free_kg > 0); const cur = lot(f.lot);
  const rows = rs.data.filter((r) => !estado || r.status === estado);
  const today = new Date().toISOString().slice(0, 10);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); try { await fn(); toast.success(ok); } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); } };
  const count = (s: string) => rs.data.filter((r) => r.status === s).length;

  async function create() {
    const r = await createReservationFull({ lot: f.lot, customer: f.customer, qty: Number(f.qty), price: f.price === "" ? null : Number(f.price), currency: f.price === "" ? null : f.currency,
      priceUnit: f.unit, expires: f.expires ? new Date(f.expires + "T23:59:59").toISOString() : null, notes: null }, newOpKey("res"));
    if (f.delivery || f.conditions) await setReservationTerms(r.id, f.delivery || null, f.conditions || null);
    setF({ ...f, qty: "", price: "", expires: "", delivery: "", conditions: "" });
  }

  return (
    <>
      <PageHeader eyebrow="RESERVAS" title="Reservas" subtitle="El vencimiento libera el café si no se confirma; la fecha de entrega pactada es el compromiso con el cliente." />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mb-6">
        {["reservada", "confirmada", "entregada", "vencida", "cancelada"].map((s) => <button key={s} onClick={() => setEstado(estado === s ? "" : s)} className="text-left"><Kpi label={resLabel[s]} value={count(s)} tone={estado === s ? "ok" : undefined} /></button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={estado ? `Reservas: ${resLabel[estado]}` : "Todas las reservas"} className="lg:col-span-2">
          <LoadState loading={rs.loading} error={rs.error} empty={!rows.length} emptyText="Sin reservas con este filtro." />
          {rows.length > 0 && <SimpleTable head={["Lote", "Cliente", "Kg", "Precio", "Vence", "Entrega pactada", "Estado", ""]} rows={rows.map((r) => {
            const l = lot(r.lot_id);
            return [l ? <LotLink id={l.id} code={l.lot_code} /> : "—", cust(r.customer_id), fmtKg(r.qty_kg),
              r.price != null ? `${r.price} ${r.currency}/${r.price_unit}` : "Sin precio", fmtDay(r.expires_at),
              <span title={r.conditions ?? ""}>{fmtDay(r.agreed_delivery_date)}{r.conditions ? " · " + r.conditions : ""}</span>, resLabel[r.status] ?? r.status,
              can && (r.status === "reservada" || r.status === "confirmada") ? <span className="flex flex-wrap gap-1">
                {r.status === "reservada" && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => confirmReservation(r.id), "Reserva confirmada")}>Confirmar</Button>}
                <Button size="sm" disabled={busy} onClick={() => run(() => deliverReservation(r.id, newOpKey("del")), "Entrega registrada")}>Entregar</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => { const d = prompt("Fecha de entrega pactada (AAAA-MM-DD)", r.agreed_delivery_date ?? ""); if (d === null) return; const c = prompt("Condiciones", r.conditions ?? ""); void run(() => setReservationTerms(r.id, d || null, c), "Condiciones guardadas"); }}>Condiciones</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => cancelReservation(r.id, "Cancelada por usuario"), "Reserva cancelada")}>Cancelar</Button></span> : null];
          })} />}
        </Section>
        {can && <Section title="Nueva reserva">
          <div className="grid gap-2">
            <select className={selectCls} value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })}><option value="">Lote liberado…</option>{sellable.map((l) => <option key={l.id} value={l.id}>{l.lot_code} · {fmtKg(l.qty_free_kg)} libres</option>)}</select>
            <select className={selectCls} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })}><option value="">Cliente…</option>{cs.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <Input placeholder={cur ? `Kg (máx. ${cur.qty_free_kg})` : "Kg"} inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Precio" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
              <select className={selectCls} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}><option>USD</option><option>CRC</option></select>
              <select className={selectCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}><option value="kg">por kg</option></select>
            </div>
            <label className="text-xs text-muted-foreground">Vence la reserva (si no se confirma)</label>
            <Input type="date" min={today} value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} />
            <label className="text-xs text-muted-foreground">Fecha de entrega pactada</label>
            <Input type="date" min={today} value={f.delivery} onChange={(e) => setF({ ...f, delivery: e.target.value })} />
            <Textarea rows={2} placeholder="Condiciones (pago, empaque, transporte…)" value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} />
            <Button disabled={busy || !f.lot || !f.customer || !(Number(f.qty) > 0)} onClick={() => run(create, "Reserva creada")}>Reservar</Button>
            {sellable.length === 0 && <p className="text-xs text-muted-foreground">No hay lotes liberados con café libre.</p>}
          </div>
        </Section>}
      </div>
    </>
  );
}
