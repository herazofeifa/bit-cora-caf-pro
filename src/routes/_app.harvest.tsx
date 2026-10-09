import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFarms, useParcels } from "@/lib/app-config-store";
import { useCloudState } from "@/lib/cloud";
import { newOpKey, listLots, type CloudLot } from "@/lib/ops-cloud";
import { enqueue, flushQueue, loadQueue, retryItem, discardItem, clearSent, useQueue, startAutoFlush } from "@/lib/offline-queue";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/harvest")({
  head: () => ({ meta: [
    { title: "Registrar cosecha — Bitácora Café Pro" },
    { name: "description", content: "Registro de cosecha con jornada, recibo y borrador sin conexión." },
  ] }),
  component: CloudHarvestPage,
});

const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function CloudHarvestPage() {
  const farms = useFarms(); const parcels = useParcels(); const cloud = useCloudState(); const queue = useQueue();
  const [units, setUnits] = useState<{ symbol: string; name: string; kg_factor: number | null }[]>([]);
  const [lots, setLots] = useState<CloudLot[]>([]);
  const [f, setF] = useState({
    farm_id: "", parcel_id: "", variety: "", harvest_date: new Date().toISOString().slice(0, 10), qty: "", uom: "kg",
    season: "", cut_type: "corte", workers: "", worker_count: "", responsible: "", initial_quality: "", notes: "",
    target: "new", lot_name: "", process_type: "lavado",
  });
  const [busy, setBusy] = useState(false);
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!cloud.orgId) return;
    void loadQueue().then(() => flushQueue()); startAutoFlush();
    void supabase.from("units").select("symbol,name,kg_factor").eq("organization_id", cloud.orgId).then(({ data }) => setUnits(data ?? []));
    void listLots().then((l) => setLots(l.filter((x) => x.physical_state === "cereza" && !x.sale_released))).catch(() => {});
  }, [cloud.orgId]);

  const parcelsOfFarm = useMemo(() => parcels.filter((p) => p.farm_id === f.farm_id), [parcels, f.farm_id]);
  const factor = f.uom === "kg" ? 1 : units.find((u) => u.symbol === f.uom)?.kg_factor ?? null;
  const qty = Number(f.qty);
  const kg = factor && Number.isFinite(qty) && qty > 0 ? Math.round(qty * factor * 1000) / 1000 : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.farm_id) return toast.error("Elige la finca.");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("La cantidad debe ser un número mayor a 0.");
    if (!factor) return toast.error(`La unidad “${f.uom}” no tiene peso en kg configurado.`);
    const workers = f.workers.split(",").map((w) => w.trim()).filter(Boolean);
    const data = {
      farm_id: f.farm_id, parcel_id: f.parcel_id || null, variety: f.variety, harvest_date: f.harvest_date, qty, uom: f.uom,
      season: f.season, cut_type: f.cut_type, workers, worker_count: f.worker_count ? Number(f.worker_count) : workers.length,
      responsible: f.responsible, initial_quality: f.initial_quality, notes: f.notes, process_type: f.process_type,
    };
    const opKey = newOpKey("harv");
    setBusy(true);
    try {
      await enqueue("harvest", `${qty} ${f.uom} · ${f.harvest_date}`, { data, targetLot: f.target === "new" ? null : f.target, lotName: f.lot_name || null }, opKey);
      await flushQueue();
      toast.message(navigator.onLine ? "Enviado. Revisa el estado abajo." : "Sin conexión: guardado como borrador en este dispositivo.");
      setF({ ...f, qty: "", workers: "", worker_count: "", notes: "", lot_name: "" });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  if (cloud.status !== "ready") return <p className="text-muted-foreground">Cargando datos del servidor…</p>;

  return (
    <>
      <PageHeader eyebrow="COSECHA · SERVIDOR" title="Registrar cosecha" subtitle="El recibo y el ingreso al lote se guardan juntos en el servidor. Sin señal, queda como borrador y se envía después." />
      {farms.length === 0 && <p className="mb-4 rounded-lg border border-border p-3 text-sm">Primero agrega una finca en <Link to="/settings" className="underline">Ajustes</Link>.</p>}
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 rounded-xl border border-border bg-card p-4 md:p-6">
        <div><Label>Finca</Label><select className={sel} value={f.farm_id} onChange={(e) => setF({ ...f, farm_id: e.target.value, parcel_id: "" })}>
          <option value="">Elegir…</option>{farms.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div><Label>Parcela</Label><select className={sel} value={f.parcel_id} onChange={up("parcel_id")}>
          <option value="">(sin parcela)</option>{parcelsOfFarm.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div><Label>Variedad</Label><Input value={f.variety} onChange={up("variety")} placeholder="Caturra" /></div>
        <div><Label>Fecha de cosecha</Label><Input type="date" value={f.harvest_date} onChange={up("harvest_date")} /></div>
        <div><Label>Cantidad</Label><Input inputMode="decimal" value={f.qty} onChange={up("qty")} placeholder="40" /></div>
        <div><Label>Unidad</Label><select className={sel} value={f.uom} onChange={up("uom")}>
          <option value="kg">kg</option>{units.map((u) => <option key={u.symbol} value={u.symbol}>{u.name} ({u.kg_factor ?? "?"} kg)</option>)}</select>
          <p className="mt-1 text-xs text-muted-foreground">{kg != null ? `= ${kg} kg` : "Configura el peso en kg de esta unidad"}</p></div>
        <div><Label>Temporada</Label><Input value={f.season} onChange={up("season")} placeholder="2025-2026" /></div>
        <div><Label>Tipo de recolección</Label><select className={sel} value={f.cut_type} onChange={up("cut_type")}>
          <option value="corte">Corte</option><option value="pasilla">Pasilla</option><option value="repela">Repela</option><option value="otro">Otro</option></select></div>
        <div><Label>Trabajadores (separados por coma)</Label><Input value={f.workers} onChange={up("workers")} placeholder="Ana, Luis" /></div>
        <div><Label>Número de trabajadores</Label><Input inputMode="numeric" value={f.worker_count} onChange={up("worker_count")} placeholder="auto" /></div>
        <div><Label>Responsable</Label><Input value={f.responsible} onChange={up("responsible")} /></div>
        <div><Label>Calidad inicial</Label><Input value={f.initial_quality} onChange={up("initial_quality")} placeholder="madura, mezcla verde…" /></div>
        <div><Label>Destino</Label><select className={sel} value={f.target} onChange={up("target")}>
          <option value="new">Crear lote nuevo</option>{lots.map((l) => <option key={l.id} value={l.id}>Sumar a {l.lot_code} · {l.friendly_name}</option>)}</select></div>
        {f.target === "new" ? (
          <div><Label>Nombre del lote</Label><Input value={f.lot_name} onChange={up("lot_name")} placeholder="Cosecha dd/mm" /></div>
        ) : <div />}
        <div className="md:col-span-2"><Label>Notas</Label><Textarea value={f.notes} onChange={up("notes")} rows={2} /></div>
        <div className="md:col-span-2"><Button type="submit" disabled={busy} className="w-full md:w-auto">Guardar cosecha</Button></div>
      </form>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-xl">Envíos de este dispositivo</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void flushQueue()}><RefreshCw className="h-4 w-4 mr-1" />Reintentar</Button>
            <Button size="sm" variant="ghost" onClick={() => void clearSent()}>Limpiar enviados</Button>
          </div>
        </div>
        {queue.length === 0 ? <p className="text-sm text-muted-foreground">Nada pendiente.</p> : (
          <ul className="space-y-2">{queue.map((q) => (
            <li key={q.opKey} className="rounded-lg border border-border p-3 text-sm flex flex-wrap items-center gap-2 justify-between">
              <span>{q.kind === "harvest" ? "Cosecha" : "Medición"} · {q.label}</span>
              <span className={q.status === "rejected" ? "text-destructive" : q.status === "sent" ? "text-primary" : "text-muted-foreground"}>
                {q.status === "pending" && <><CloudOff className="inline h-4 w-4 mr-1" />Pendiente (no enviado aún)</>}
                {q.status === "sending" && "Enviando…"}
                {q.status === "sent" && `Confirmado por el servidor · ${q.result ?? ""}`}
                {q.status === "rejected" && `Rechazado: ${q.error}`}
              </span>
              {q.status === "rejected" && <span className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => void retryItem(q.opKey)}>Reintentar</Button>
                <Button size="sm" variant="ghost" onClick={() => void discardItem(q.opKey)}><Trash2 className="h-4 w-4" /></Button></span>}
            </li>))}</ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Inventario, reservas y entregas solo funcionan con conexión: así nadie vende el mismo café dos veces.</p>
      </section>
    </>
  );
}
