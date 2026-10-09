import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { LoadState, LotLink, Section, SimpleTable, physLabel, selectCls, stateLabel, type Lot } from "@/components/ops-ui";
import { fmtDay, fmtKg, sel, useOrgQuery } from "@/lib/org-data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/traceability")({
  head: () => ({ meta: [
    { title: "Trazabilidad — Bitácora Café Pro" },
    { name: "description", content: "Busca un lote por código, finca, variedad, proceso, cliente o reserva y mira su genealogía completa." },
    { property: "og:title", content: "Trazabilidad — Bitácora Café Pro" },
    { property: "og:description", content: "Genealogía de lotes: cosecha, divisiones y uniones." },
  ] }),
  component: TracePage,
});

type Link_ = { parent_lot_id: string; child_lot_id: string; kind: string; qty_kg: number };
type R = { id: string; lot_id: string; customer_id: string; status: string; qty_kg: number };

function TracePage() {
  const lots = useOrgQuery<Lot[]>("t-l", (o) => sel("lots", "*", o), ["lots"], []);
  const links = useOrgQuery<Link_[]>("t-k", async () => { const { data, error } = await supabase.from("lot_links").select("*"); if (error) throw error; return data as Link_[]; }, ["lots"], []);
  const farms = useOrgQuery<{ id: string; name: string }[]>("t-f", (o) => sel("farms", "id,name", o, "name", true), ["farms"], []);
  const cs = useOrgQuery<{ id: string; name: string }[]>("t-c", (o) => sel("customers", "id,name", o, "name", true), ["customers"], []);
  const rs = useOrgQuery<R[]>("t-r", (o) => sel("reservations", "id,lot_id,customer_id,status,qty_kg", o, "reserved_at"), ["reservations"], []);
  const pubs = useOrgQuery<{ lot_id: string; is_public: boolean; public_token: string }[]>("t-p", (o) => sel("lot_public_profiles", "lot_id,is_public,public_token", o, "updated_at"), ["lot_public_profiles"], []);
  const [f, setF] = useState({ q: "", farm: "", customer: "", from: "", to: "" }); const [sel_, setSel] = useState<string | null>(null);
  const farm = (id: string | null) => farms.data.find((x) => x.id === id)?.name ?? "—";

  const rows = useMemo(() => lots.data.filter((l) => {
    const custs = rs.data.filter((r) => r.lot_id === l.id);
    const text = `${l.lot_code} ${l.friendly_name} ${l.variety} ${l.process_type} ${farm(l.farm_id)} ${custs.map((r) => r.id.slice(0, 8)).join(" ")}`.toLowerCase();
    const d = l.created_at.slice(0, 10);
    return (!f.q || text.includes(f.q.toLowerCase())) && (!f.farm || l.farm_id === f.farm) && (!f.customer || custs.some((r) => r.customer_id === f.customer))
      && (!f.from || d >= f.from) && (!f.to || d <= f.to);
  }), [lots.data, rs.data, f, farms.data]);

  const lot = lots.data.find((l) => l.id === sel_);
  const parents = links.data.filter((k) => k.child_lot_id === sel_); const children = links.data.filter((k) => k.parent_lot_id === sel_);
  const byId = (id: string) => lots.data.find((l) => l.id === id);
  const pub = pubs.data.find((p) => p.lot_id === sel_ && p.is_public);

  return (
    <>
      <PageHeader eyebrow="TRAZABILIDAD" title="Trazabilidad" subtitle="De la cosecha a la entrega: elige un lote para ver de dónde viene y a dónde fue." />
      <div className="grid gap-2 sm:grid-cols-5 mb-4">
        <Input className="sm:col-span-2" placeholder="Código, variedad, proceso o nº de reserva" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select className={selectCls} value={f.farm} onChange={(e) => setF({ ...f, farm: e.target.value })}><option value="">Toda finca</option>{farms.data.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select className={selectCls} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })}><option value="">Todo cliente</option>{cs.data.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <div className="flex gap-1"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`${rows.length} lotes`}>
          <LoadState loading={lots.loading} error={lots.error} empty={!rows.length} />
          <ul className="divide-y divide-border">{rows.map((l) => (
            <li key={l.id}><button className={"w-full text-left py-2 px-1 text-sm " + (sel_ === l.id ? "bg-secondary rounded" : "")} onClick={() => setSel(l.id)}>
              <span className="font-mono">{l.lot_code}</span> · {l.friendly_name} <span className="text-muted-foreground">· {farm(l.farm_id)} · {l.variety || "—"} · {l.process_type}</span></button></li>))}</ul>
        </Section>
        <Section title={lot ? `Historia de ${lot.lot_code}` : "Elige un lote"}>
          {!lot ? <p className="text-sm text-muted-foreground">Toca un lote de la lista.</p> : (
            <div className="space-y-4 text-sm">
              <p><b>{lot.friendly_name}</b> · {farm(lot.farm_id)} · {lot.variety || "—"} · {lot.process_type} · {physLabel(lot.physical_state)} · {stateLabel(lot.commercial_state)}</p>
              <p>Creado {fmtDay(lot.created_at)} con {fmtKg(lot.qty_initial_kg)}{lot.harvest_ticket_id ? " desde un recibo de cosecha" : ""}. Hoy: {fmtKg(lot.qty_current_kg)}, vendido {fmtKg(lot.qty_sold_kg)}.</p>
              <div><div className="eyebrow mb-1">Viene de</div>{parents.length ? parents.map((k) => { const p = byId(k.parent_lot_id); return <div key={k.parent_lot_id}>{p ? <LotLink id={p.id} code={p.lot_code} /> : "—"} · {k.kind === "merge" ? "unión" : "división"} · {fmtKg(k.qty_kg)}</div>; }) : <div className="text-muted-foreground">{lot.harvest_ticket_id ? "Cosecha directa" : "Lote original"}</div>}</div>
              <div><div className="eyebrow mb-1">Dio origen a</div>{children.length ? children.map((k) => { const c = byId(k.child_lot_id); return <div key={k.child_lot_id}>{c ? <LotLink id={c.id} code={c.lot_code} /> : "—"} · {k.kind === "merge" ? "unión" : "división"} · {fmtKg(k.qty_kg)}</div>; }) : <div className="text-muted-foreground">Ninguno</div>}</div>
              <div><div className="eyebrow mb-1">Reservas y entregas</div>
                {rs.data.filter((r) => r.lot_id === lot.id).length ? <SimpleTable head={["Nº", "Cliente", "Kg", "Estado"]} rows={rs.data.filter((r) => r.lot_id === lot.id).map((r) => [r.id.slice(0, 8), cs.data.find((c) => c.id === r.customer_id)?.name ?? "—", fmtKg(r.qty_kg), r.status])} /> : <div className="text-muted-foreground">Sin reservas</div>}</div>
              <div className="flex flex-wrap gap-3"><LotLink id={lot.id} code="Abrir ficha completa (fases, fotos, PDF)" />
                {pub && <a className="underline" href={`/t/${pub.public_token}`} target="_blank" rel="noreferrer">Ficha pública</a>}</div>
            </div>)}
        </Section>
      </div>
    </>
  );
}
