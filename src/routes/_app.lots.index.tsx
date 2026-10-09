import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadState, LotLink, Section, SimpleTable, physLabel, qualLabel, selectCls, stateLabel, type Lot } from "@/components/ops-ui";
import { sel, useOrgQuery, fmtKg } from "@/lib/org-data";
import { createLot, friendlyError, mergeLots, newOpKey, splitLot } from "@/lib/ops-cloud";
import { useCurrentRole } from "@/lib/permissions";

type Search = { estado?: string; q?: string };
export const Route = createFileRoute("/_app/lots/")({
  validateSearch: (s: Record<string, unknown>): Search => ({ estado: typeof s.estado === "string" ? s.estado : undefined, q: typeof s.q === "string" ? s.q : undefined }),
  head: () => ({ meta: [
    { title: "Lotes — Bitácora Café Pro" },
    { name: "description", content: "Todos los lotes de la organización con estado físico, comercial, calidad y kilos." },
    { property: "og:title", content: "Lotes — Bitácora Café Pro" },
    { property: "og:description", content: "Lotes con estado físico, comercial y calidad." },
  ] }),
  component: LotsPage,
});

function LotsPage() {
  const search = Route.useSearch(); const role = useCurrentRole();
  const { data: lots, loading, error } = useOrgQuery<Lot[]>("lots", (o) => sel<Lot[]>("lots", "*", o), ["lots"], []);
  const { data: farms } = useOrgQuery<{ id: string; name: string }[]>("farms-min", (o) => sel("farms", "id,name", o, "name", true), ["farms"], []);
  const [q, setQ] = useState(search.q ?? ""); const [estado, setEstado] = useState(search.estado ?? "");
  const [nl, setNl] = useState({ name: "", qty: "", farm: "", variety: "", process: "lavado", state: "cereza" });
  const [pick, setPick] = useState<string[]>([]); const [mergeName, setMergeName] = useState("");
  const [split, setSplit] = useState({ lot: "", parts: "" }); const [busy, setBusy] = useState(false);

  const rows = useMemo(() => lots.filter((l) =>
    (!estado || l.commercial_state === estado || l.physical_state === estado) &&
    (!q || `${l.lot_code} ${l.friendly_name} ${l.variety} ${l.process_type}`.toLowerCase().includes(q.toLowerCase()))), [lots, q, estado]);
  const canAdmin = role === "administrador"; const canCreate = canAdmin || role === "encargado_beneficio" || role === "productor";
  const run = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); try { await fn(); toast.success(ok); } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); } };

  return (
    <>
      <PageHeader eyebrow="LOTES" title="Lotes" subtitle="Cada lote con su estado, kilos y calidad. Toca el código para ver su historia completa." />
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="max-w-xs" placeholder="Buscar código, nombre, variedad…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={selectCls + " max-w-xs"} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {[...new Set(lots.flatMap((l) => [l.commercial_state, l.physical_state]))].map((s) => <option key={s} value={s}>{stateLabel(s) !== s ? stateLabel(s) : physLabel(s)}</option>)}
        </select>
      </div>
      <Section title={`${rows.length} lotes`}>
        <LoadState loading={loading} error={error} empty={!rows.length} emptyText="No hay lotes con este filtro. Registra una cosecha para crear el primero." />
        {rows.length > 0 && <SimpleTable head={["Código", "Nombre", "Finca", "Estado físico", "Comercial", "Calidad", "Actual", "Libre"]}
          rows={rows.map((l) => [
            <span className="flex items-center gap-2">{canAdmin && <input type="checkbox" checked={pick.includes(l.id)} onChange={(e) => setPick(e.target.checked ? [...pick, l.id] : pick.filter((x) => x !== l.id))} />}<LotLink id={l.id} code={l.lot_code} /></span>,
            l.friendly_name, farms.find((f) => f.id === l.farm_id)?.name ?? "—", physLabel(l.physical_state), stateLabel(l.commercial_state), qualLabel(l.quality_status),
            fmtKg(l.qty_current_kg), fmtKg(l.qty_free_kg)])} />}
      </Section>

      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        {canCreate && <Section title="Crear lote manual">
          <div className="grid gap-2">
            <Input placeholder="Nombre" value={nl.name} onChange={(e) => setNl({ ...nl, name: e.target.value })} />
            <Input placeholder="Kg iniciales" inputMode="decimal" value={nl.qty} onChange={(e) => setNl({ ...nl, qty: e.target.value })} />
            <select className={selectCls} value={nl.farm} onChange={(e) => setNl({ ...nl, farm: e.target.value })}><option value="">Finca…</option>{farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
            <Input placeholder="Variedad" value={nl.variety} onChange={(e) => setNl({ ...nl, variety: e.target.value })} />
            <select className={selectCls} value={nl.process} onChange={(e) => setNl({ ...nl, process: e.target.value })}>{["lavado", "honey", "natural", "anaerobico", "personalizado"].map((p) => <option key={p}>{p}</option>)}</select>
            <Button disabled={busy || !nl.name || !(Number(nl.qty) > 0)} onClick={() => run(() => createLot(nl.name, Number(nl.qty), nl.farm || null, null, nl.variety, nl.process, nl.state, newOpKey("lot")), "Lote creado")}>Crear lote</Button>
            <p className="text-xs text-muted-foreground">Lo normal es crear el lote desde Cosecha; esto es para café recibido de otra forma.</p>
          </div>
        </Section>}
        {canAdmin && <Section title="Unir lotes">
          <p className="text-sm mb-2">{pick.length} marcados en la tabla.</p>
          <Input placeholder="Nombre del lote nuevo" value={mergeName} onChange={(e) => setMergeName(e.target.value)} />
          <Button className="mt-2 w-full" disabled={busy || pick.length < 2 || !mergeName} onClick={() => run(async () => { await mergeLots(pick, mergeName); setPick([]); setMergeName(""); }, "Lotes unidos")}>Unir {pick.length} lotes</Button>
        </Section>}
        {canAdmin && <Section title="Dividir lote">
          <select className={selectCls} value={split.lot} onChange={(e) => setSplit({ ...split, lot: e.target.value })}><option value="">Lote…</option>{lots.filter((l) => l.qty_current_kg > 0).map((l) => <option key={l.id} value={l.id}>{l.lot_code} · {fmtKg(l.qty_current_kg)}</option>)}</select>
          <Input className="mt-2" placeholder="Kg de cada parte, ej. 100, 50" value={split.parts} onChange={(e) => setSplit({ ...split, parts: e.target.value })} />
          <Button className="mt-2 w-full" disabled={busy || !split.lot || split.parts.split(",").filter((x) => Number(x) > 0).length < 2}
            onClick={() => run(() => splitLot(split.lot, split.parts.split(",").map((x) => ({ qty_kg: Number(x.trim()) })).filter((p) => p.qty_kg > 0)), "Lote dividido")}>Dividir</Button>
        </Section>}
      </div>
    </>
  );
}
