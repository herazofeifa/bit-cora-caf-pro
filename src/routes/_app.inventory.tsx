import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kpi, LoadState, LotLink, Section, SimpleTable, selectCls, stateLabel, type Lot } from "@/components/ops-ui";
import { fmtDate, fmtKg, loadOrgSettings, sel, useOrgQuery, DEFAULT_ORG_SETTINGS } from "@/lib/org-data";
import { adjustInventory, friendlyError, setLotLocation } from "@/lib/ops-cloud";
import { useCurrentRole } from "@/lib/permissions";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({ meta: [
    { title: "Inventario — Bitácora Café Pro" },
    { name: "description", content: "Kilos actuales, libres, reservados, comprometidos, bloqueados y vendidos por lote, con movimientos y ubicación." },
    { property: "og:title", content: "Inventario — Bitácora Café Pro" },
    { property: "og:description", content: "Balance de inventario por lote y movimientos." },
  ] }),
  component: InventoryPage,
});

type Mov = { id: string; lot_id: string; movement_type: string; qty_kg: number; reason: string | null; created_by: string | null; created_at: string };

function InventoryPage() {
  const role = useCurrentRole(); const canAdj = role === "administrador" || role === "encargado_beneficio";
  const lots = useOrgQuery<Lot[]>("inv-l", (o) => sel("lots", "*", o), ["lots"], []);
  const movs = useOrgQuery<Mov[]>("inv-m", (o) => sel("stock_movements", "*", o, "created_at", false, 200), ["stock_movements"], []);
  const people = useOrgQuery<{ id: string; full_name: string | null; email: string | null }[]>("inv-p", async () => {
    const { supabase } = await import("@/integrations/supabase/client"); const { data } = await supabase.from("profiles").select("id,full_name,email"); return data ?? [];
  }, [], []);
  const st = useOrgQuery("inv-s", loadOrgSettings, ["org_settings"], DEFAULT_ORG_SETTINGS);
  const [adj, setAdj] = useState({ lot: "", delta: "", reason: "" }); const [loc, setLoc] = useState({ lot: "", location: "" }); const [busy, setBusy] = useState(false);
  const L = lots.data.filter((l) => l.qty_current_kg > 0 || l.qty_sold_kg > 0);
  const s = (k: keyof Lot) => L.reduce((a, l) => a + Number(l[k] ?? 0), 0);
  const who = (id: string | null) => { const p = people.data.find((x) => x.id === id); return p?.full_name || p?.email || "—"; };
  const code = (id: string) => lots.data.find((l) => l.id === id)?.lot_code ?? "—";
  const run = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); try { await fn(); toast.success(ok); } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); } };
  const low = L.filter((l) => l.sale_released && l.qty_free_kg < st.data.low_stock_kg);

  return (
    <>
      <PageHeader eyebrow="INVENTARIO" title="Inventario" subtitle={`Balance real por lote. Umbral de stock bajo: ${st.data.low_stock_kg} kg libres (se cambia en Ajustes).`} />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-6 mb-6">
        <Kpi label="Actual" value={fmtKg(s("qty_current_kg"))} /><Kpi label="Libre" value={fmtKg(s("qty_free_kg"))} />
        <Kpi label="Reservado" value={fmtKg(s("qty_reserved_kg"))} /><Kpi label="Comprometido" value={fmtKg(s("qty_committed_kg"))} />
        <Kpi label="Bloqueado" value={fmtKg(s("qty_blocked_kg"))} /><Kpi label="Vendido" value={fmtKg(s("qty_sold_kg"))} />
      </div>
      {low.length > 0 && <p className="mb-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">Stock bajo en {low.map((l) => l.lot_code).join(", ")}.</p>}
      <Section title="Por lote">
        <LoadState loading={lots.loading} error={lots.error} empty={!L.length} />
        {L.length > 0 && <SimpleTable head={["Lote", "Estado", "Ubicación", "Actual", "Libre", "Reserv.", "Comprom.", "Bloq.", "Vendido"]} rows={L.map((l) => [
          <LotLink id={l.id} code={l.lot_code} />, stateLabel(l.commercial_state), l.current_location ?? "—", fmtKg(l.qty_current_kg),
          <span className={l.sale_released && l.qty_free_kg < st.data.low_stock_kg ? "text-destructive font-medium" : ""}>{fmtKg(l.qty_free_kg)}</span>,
          fmtKg(l.qty_reserved_kg), fmtKg(l.qty_committed_kg), fmtKg(l.qty_blocked_kg), fmtKg(l.qty_sold_kg)])} />}
      </Section>
      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        <Section title="Movimientos recientes" className="lg:col-span-2">
          <LoadState loading={movs.loading} error={movs.error} empty={!movs.data.length} />
          {movs.data.length > 0 && <SimpleTable head={["Fecha y hora", "Lote", "Tipo", "Kg", "Motivo", "Quién"]} rows={movs.data.slice(0, 60).map((m) => [
            fmtDate(m.created_at), code(m.lot_id), m.movement_type, `${m.qty_kg > 0 ? "+" : ""}${Number(m.qty_kg)}`, m.reason ?? "—", who(m.created_by)])} />}
        </Section>
        {canAdj && <div className="space-y-4">
          <Section title="Ajuste con motivo">
            <div className="grid gap-2">
              <select className={selectCls} value={adj.lot} onChange={(e) => setAdj({ ...adj, lot: e.target.value })}><option value="">Lote…</option>{lots.data.map((l) => <option key={l.id} value={l.id}>{l.lot_code}</option>)}</select>
              <Input placeholder="Kg (+ entra, − sale)" inputMode="decimal" value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} />
              <Input placeholder="Motivo (obligatorio)" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
              <Button disabled={busy || !adj.lot || !Number(adj.delta) || !adj.reason.trim()} onClick={() => run(async () => { await adjustInventory(adj.lot, Number(adj.delta), adj.reason); setAdj({ lot: "", delta: "", reason: "" }); }, "Ajuste registrado")}>Registrar ajuste</Button>
            </div>
          </Section>
          <Section title="Cambiar ubicación">
            <div className="grid gap-2">
              <select className={selectCls} value={loc.lot} onChange={(e) => setLoc({ ...loc, lot: e.target.value })}><option value="">Lote…</option>{lots.data.map((l) => <option key={l.id} value={l.id}>{l.lot_code}</option>)}</select>
              <Input placeholder="Bodega, patio, secadora…" value={loc.location} onChange={(e) => setLoc({ ...loc, location: e.target.value })} />
              <Button variant="outline" disabled={busy || !loc.lot} onClick={() => run(() => setLotLocation(loc.lot, loc.location), "Ubicación actualizada")}>Guardar ubicación</Button>
            </div>
          </Section>
        </div>}
      </div>
    </>
  );
}
