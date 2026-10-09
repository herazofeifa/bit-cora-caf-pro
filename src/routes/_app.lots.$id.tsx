import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Download, FileUp, Lock, Play, Square } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCloudState } from "@/lib/cloud";
import { useCurrentRole } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  closePhase, confirmReservation, cancelReservation, createReservation, createSacks, deliverReservation, friendlyError, getLot,
  logPhaseVariable, newOpKey, publishLot, declareLotExport, recordQuality, releaseLot, signedFileUrl, startPhase, uploadLotFile, type CloudLot,
} from "@/lib/ops-cloud";
import { enqueue, flushQueue } from "@/lib/offline-queue";
import { lotSheetPdf, sackLabelsPdf } from "@/lib/pdf";
import { QualityForm, qualitySummary, type QualityData } from "@/components/quality-form";
import { commercialStateLabel } from "@/lib/helpers";
import type { CommercialState } from "@/types/domain";

export const Route = createFileRoute("/_app/lots/$id")({
  head: () => ({ meta: [
    { title: "Ficha de lote — Bitácora Café Pro" },
    { name: "description", content: "Fases, mediciones, reservas, archivos, sacos y ficha pública del lote." },
  ] }),
  component: CloudLotPage,
});

type Phase = { id: string; name: string; status: string; started_at: string; ended_at: string | null; weight_in_kg: number | null; weight_out_kg: number | null;
  expected_minutes: number | null; variables: { key: string; label?: string; unit?: string; min?: number; max?: number }[] };
type VarLog = { id: string; phase_id: string | null; value_number: number | null; value: { label?: string; unit?: string; in_range?: boolean } | null; measured_at: string };
type Res = { id: string; qty_kg: number; price: number | null; currency: string | null; status: string; customer_id: string; expires_at: string | null };
type FileRow = { id: string; kind: string; title: string; storage_path: string; mime_type: string; public_selected: boolean; phase_id: string | null };
type Sack = { id: string; seq: number; sack_token: string; weight_kg: number | null };
type Tpl = { id: string; name: string; process_type: string; version: number; phases: { name: string; expected_minutes?: number }[] };

const STATES = ["cereza", "despulpado", "fermentado", "lavado", "pergamino_humedo", "pergamino_seco", "oro"];
const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card p-4 md:p-5"><h2 className="font-serif text-lg mb-3">{title}</h2>{children}</section>
);

function CloudLotPage() {
  const { id } = Route.useParams(); const cloud = useCloudState(); const role = useCurrentRole();
  const [lot, setLot] = useState<CloudLot | null | undefined>(undefined);
  const [phases, setPhases] = useState<Phase[]>([]); const [vars, setVars] = useState<VarLog[]>([]);
  const [res, setRes] = useState<Res[]>([]); const [files, setFiles] = useState<FileRow[]>([]); const [sacks, setSacks] = useState<Sack[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]); const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [profile, setProfile] = useState<{ is_public: boolean; public_token: string; short_story: string | null; tasting_notes: string | null; visibility: Record<string, boolean>; exported_at?: string | null } | null>(null);
  const [exportDate, setExportDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [phaseForm, setPhaseForm] = useState({ tpl: "", name: "", expected: "" });
  const [meas, setMeas] = useState({ key: "", value: "" });
  const [close, setClose] = useState({ weight: "", state: "", notes: "" });
  const [resForm, setResForm] = useState({ customer: "", qty: "", price: "", currency: "USD", expires: "" });
  const [fileForm, setFileForm] = useState<{ kind: string; title: string; file: File | null }>({ kind: "photo", title: "", file: null });
  const [sackForm, setSackForm] = useState({ count: "", weight: "46" });
  const [pub, setPub] = useState({ story: "", notes: "", measurements: false, producer: true });

  type Lineage = { origins: { farm: string; parcel: string | null; region: string | null; country: string; altitude_m: number | null }[];
    sources: { lot_code: string; kind: string; qty_kg: number }[];
    phases: { lot_code: string; inherited: boolean; name: string; status: string; started_at: string; ended_at: string | null; weight_in_kg: number | null; weight_out_kg: number | null }[] };
  const [lineage, setLineage] = useState<Lineage | null>(null);
  const [lastQ, setLastQ] = useState<QRow | null>(null);
  const [allQ, setAllQ] = useState<QRow[]>([]);
  const load = useCallback(async () => {
    try {
      const l = await getLot(id); setLot(l); if (!l) return;
      void (async () => {
        const { data: lin } = await supabase.rpc("lot_lineage" as never, { _lot: id } as never);
        setLineage((lin ?? null) as Lineage | null);
        const qs = await lotQualityWithLineage(l, (lin ?? null) as Lineage | null);
        setAllQ(qs);
        setLastQ(qs.filter((x) => !x.source_code).at(-1) ?? qs.filter((x) => x.status === "aprobado").at(-1) ?? null);
      })();
      const [p, v, r, f, s, t, c, pp] = await Promise.all([
        supabase.from("process_phases").select("*").eq("lot_id", id).order("started_at"),
        supabase.from("variable_logs").select("id,phase_id,value_number,value,measured_at").eq("lot_id", id).order("measured_at"),
        supabase.from("reservations").select("id,qty_kg,price,currency,status,customer_id,expires_at").eq("lot_id", id).order("reserved_at"),
        supabase.from("files").select("id,kind,title,storage_path,mime_type,public_selected,phase_id").eq("lot_id", id).order("created_at"),
        supabase.from("sacks").select("id,seq,sack_token,weight_kg").eq("lot_id", id).order("seq"),
        supabase.from("process_templates").select("id,name,process_type,version,phases").eq("active", true).order("name"),
        supabase.from("customers").select("id,name").order("name"),
        supabase.from("lot_public_profiles").select("is_public,public_token,short_story,tasting_notes,visibility,exported_at").eq("lot_id", id).maybeSingle(),
      ]);
      setPhases((p.data ?? []) as unknown as Phase[]); setVars((v.data ?? []) as unknown as VarLog[]); setRes((r.data ?? []) as Res[]);
      setFiles((f.data ?? []) as FileRow[]); setSacks((s.data ?? []) as Sack[]); setTpls((t.data ?? []) as unknown as Tpl[]);
      setCustomers(c.data ?? []); setProfile(pp.data as never);
      if (pp.data) setPub((x) => ({ ...x, story: pp.data!.short_story ?? "", notes: pp.data!.tasting_notes ?? "" }));
    } catch (e) { toast.error(friendlyError(e)); }
  }, [id]);
  useEffect(() => {
    if (!cloud.orgId) return; void load();
    const ch = supabase.channel(`lot-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lots", filter: `id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `lot_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "process_phases", filter: `lot_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "variable_logs", filter: `lot_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "files", filter: `lot_id=eq.${id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [cloud.orgId, id, load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(); } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  };

  if (lot === undefined) return <p className="text-muted-foreground">Cargando lote…</p>;
  if (lot === null) return <p>Lote no encontrado o sin acceso. <Link to="/lots" className="underline">Volver</Link></p>;

  const running = phases.find((p) => p.status !== "finished");
  const canProcess = role === "administrador" || role === "encargado_beneficio";
  const canSell = role === "administrador" || role === "comercial";
  const tpl = tpls.find((t) => t.id === phaseForm.tpl);
  const custName = (cid: string) => customers.find((c) => c.id === cid)?.name ?? "—";
  const publicUrl = profile ? `${window.location.origin}/t/${profile.public_token}` : null;

  return (
    <>
      <Link to="/lots" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-3"><ArrowLeft className="h-4 w-4" />Lotes</Link>
      <PageHeader eyebrow={lot.lot_code} title={lot.friendly_name} subtitle={`${lot.variety || "—"} · ${lot.process_type} · ${lot.physical_state}`}
        action={<Button variant="outline" disabled={busy} onClick={() => run(async () => {
          const [farm, parcel] = await Promise.all([
            lot.farm_id ? supabase.from("farms").select("name,region,altitude_m").eq("id", lot.farm_id).maybeSingle() : Promise.resolve({ data: null }),
            lot.parcel_id ? supabase.from("parcels").select("name,altitude_m").eq("id", lot.parcel_id).maybeSingle() : Promise.resolve({ data: null }),
          ]);
          const photos: { title: string; dataUrl: string }[] = [];
          for (const f of files.filter((x) => x.public_selected && x.mime_type.startsWith("image/") && x.mime_type !== "image/webp")) {
            const blob = await (await fetch(await signedFileUrl(f.storage_path))).blob();
            photos.push({ title: f.title, dataUrl: await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(blob); }) });
          }
          const fd = farm.data as { name: string; region: string | null; altitude_m: number | null } | null;
          const pd = parcel.data as { name: string; altitude_m: number | null } | null;
          await lotSheetPdf({ lot: { ...lot, created_at: lot.created_at }, origin: { farm: fd?.name, region: fd?.region, parcel: pd?.name, altitude: pd?.altitude_m ?? fd?.altitude_m },
            origins: lineage?.origins, sources: lineage?.sources,
            phases: [...(lineage?.phases ?? []).filter((x) => x.inherited).map((x) => ({ ...x, name: `${x.name} (de ${x.lot_code})` })), ...phases], quality: allQ.map((x) => ({ ...x, status: x.source_code ? `${x.status} (heredada de ${x.source_code})` : x.status, defects: qualitySummary(x.data).defects, notes: [qualitySummary(x.data).sca, x.data?.cupping, x.data?.notes].filter(Boolean).join(" · ") })),
            photos, story: profile?.short_story, tasting: profile?.tasting_notes, publicUrl: profile?.is_public ? publicUrl : null });
        }, "Ficha PDF generada")}><Download className="h-4 w-4 mr-1" />Ficha PDF</Button>} />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mb-6 text-sm">
        {[["Actual", lot.qty_current_kg], ["Libre", lot.qty_free_kg], ["Reservado", lot.qty_reserved_kg], ["Comprometido", lot.qty_committed_kg], ["Vendido", lot.qty_sold_kg]].map(([k, v]) => (
          <div key={k as string} className="rounded-lg border border-border p-3"><div className="eyebrow">{k}</div><div className="text-xl font-medium">{Number(v)} kg</div></div>))}
      </div>
      <p className="mb-6 text-sm">Estado comercial: <b>{commercialStateLabel[lot.commercial_state as CommercialState] ?? lot.commercial_state}</b> · Calidad: {lot.quality_status}
        {lot.current_moisture != null && <> · Humedad {lot.current_moisture}%</>}</p>

      {lineage && (lineage.origins.length > 1 || lineage.sources.length > 0) && (
        <div className="rounded-lg border border-border p-3 mb-6 text-sm space-y-1">
          <div className="eyebrow">Procedencia</div>
          {lineage.origins.length > 0 && <p>{lineage.origins.length > 1 ? "Orígenes de la mezcla: " : "Origen: "}
            {lineage.origins.map((o) => [o.farm, o.parcel, o.region].filter(Boolean).join(" · ")).join(" / ")}</p>}
          {lineage.sources.length > 0 && <p>Viene de: {lineage.sources.map((x) => `${x.lot_code} (${x.kind === "merge" ? "mezcla" : "división"}, ${x.qty_kg} kg)`).join(", ")}</p>}
          {lineage.phases.filter((x) => x.inherited).length > 0 && <ul className="text-xs text-muted-foreground">
            {lineage.phases.filter((x) => x.inherited).map((x, i) => <li key={i}>{x.name} · lote {x.lot_code} · {new Date(x.started_at).toLocaleDateString()}{x.ended_at ? ` – ${new Date(x.ended_at).toLocaleDateString()}` : ""}</li>)}</ul>}
        </div>)}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Proceso">
          <ul className="text-sm space-y-2 mb-4">{phases.map((p) => (
            <li key={p.id} className="rounded-lg border border-border p-2">
              <div className="font-medium">{p.name} {p.status !== "finished" ? "· en curso" : ""}</div>
              <div className="text-xs text-muted-foreground">{new Date(p.started_at).toLocaleString()} → {p.ended_at ? new Date(p.ended_at).toLocaleString() : "…"}
                {p.weight_in_kg != null && ` · entra ${p.weight_in_kg} kg`}{p.weight_out_kg != null && ` · sale ${p.weight_out_kg} kg`}</div>
              {vars.filter((v) => v.phase_id === p.id).map((v) => (
                <div key={v.id} className={"text-xs " + (v.value?.in_range === false ? "text-destructive" : "")}>{v.value?.label}: {v.value_number} {v.value?.unit} {v.value?.in_range === false && "(fuera de rango)"}</div>))}
            </li>))}{phases.length === 0 && <li className="text-muted-foreground">Sin fases todavía.</li>}</ul>

          {canProcess && !running && (
            <div className="grid gap-2">
              <Label>Iniciar fase</Label>
              <select className={sel} value={phaseForm.tpl} onChange={(e) => setPhaseForm({ ...phaseForm, tpl: e.target.value, name: "" })}>
                <option value="">Fase libre (sin plantilla)</option>{tpls.map((t) => <option key={t.id} value={t.id}>{t.name} v{t.version}</option>)}</select>
              {tpl ? <select className={sel} value={phaseForm.name} onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })}>
                <option value="">Elegir fase…</option>{tpl.phases.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
                : <Input placeholder="Nombre de la fase" value={phaseForm.name} onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })} />}
              {!tpl && <Input placeholder="Duración esperada (horas)" inputMode="decimal" value={phaseForm.expected} onChange={(e) => setPhaseForm({ ...phaseForm, expected: e.target.value })} />}
              <Button disabled={busy || !phaseForm.name} onClick={() => run(() => startPhase(lot.id, phaseForm.name, phaseForm.tpl || null,
                phaseForm.expected ? Math.round(Number(phaseForm.expected) * 60) : null, newOpKey("phase")), "Fase iniciada")}><Play className="h-4 w-4 mr-1" />Iniciar</Button>
            </div>)}

          {canProcess && running && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Medición en {running.name}</Label>
                <div className="flex gap-2">
                  <select className={sel} value={meas.key} onChange={(e) => setMeas({ ...meas, key: e.target.value })}>
                    <option value="">Variable…</option>
                    {(running.variables.length ? running.variables : [{ key: "temperatura", label: "Temperatura" }, { key: "ph", label: "pH" }, { key: "brix", label: "Brix" }, { key: "humedad", label: "Humedad" }])
                      .map((v) => <option key={v.key} value={v.key}>{v.label ?? v.key}{v.min != null ? ` (${v.min}–${v.max} ${v.unit ?? ""})` : ""}</option>)}
                  </select>
                  <Input className="w-28" inputMode="decimal" placeholder="Valor" value={meas.value} onChange={(e) => setMeas({ ...meas, value: e.target.value })} />
                </div>
                <Button variant="outline" disabled={busy || !meas.key || !Number.isFinite(Number(meas.value)) || meas.value === ""} onClick={async () => {
                  const key = newOpKey("meas");
                  await enqueue("measurement", `${meas.key}=${meas.value} · ${lot.lot_code}`, { phase: running.id, key: meas.key, value: Number(meas.value), unit: null }, key);
                  await flushQueue(); setMeas({ key: "", value: "" }); await load();
                  toast.message(navigator.onLine ? "Medición enviada" : "Sin conexión: medición guardada como borrador");
                }}>Registrar medición</Button>
              </div>
              <div className="grid gap-2 border-t border-border pt-3">
                <Label>Cerrar fase con el peso medido (kg)</Label>
                <Input inputMode="decimal" placeholder={`Peso actual ${lot.qty_current_kg} kg`} value={close.weight} onChange={(e) => setClose({ ...close, weight: e.target.value })} />
                <select className={sel} value={close.state} onChange={(e) => setClose({ ...close, state: e.target.value })}>
                  <option value="">Estado físico al salir (sin cambio)</option>{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                <Textarea rows={2} placeholder="Notas" value={close.notes} onChange={(e) => setClose({ ...close, notes: e.target.value })} />
                {close.weight && Number(close.weight) < lot.qty_current_kg && <p className="text-xs text-muted-foreground">Se registrará una merma de proceso de {(lot.qty_current_kg - Number(close.weight)).toFixed(2)} kg.</p>}
                <Button disabled={busy || close.weight === ""} onClick={() => run(() => closePhase(running.id, Number(close.weight), close.state || null, close.notes || null, newOpKey("close")), "Fase cerrada")}>
                  <Square className="h-4 w-4 mr-1" />Cerrar fase</Button>
              </div>
            </div>)}
        </Card>

        <Card title="Calidad y liberación">
          {lastQ && <p className="text-sm mb-2">{lastQ.source_code ? `Calidad heredada del lote de origen ${lastQ.source_code} (sin muestra propia de este lote)` : "Última evaluación"} ({fmtDay(lastQ.sampled_at)}): {lastQ.status}{lastQ.score != null && ` · SCA ${lastQ.score}`} · Defectos: {qualitySummary(lastQ.data).defects}
            {qualitySummary(lastQ.data).sca && <span className="block text-xs text-muted-foreground">{qualitySummary(lastQ.data).sca}</span>}</p>}
          {canProcess && <details className="mb-3"><summary className="text-sm cursor-pointer font-medium">Registrar evaluación de calidad (SCA, defectos)</summary><div className="mt-2"><QualityForm fixedLot={lot.id} onSaved={() => void load()} /></div></details>}
          {canProcess ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={() => run(() => recordQuality(lot.id, "bloqueado", null, null), "Lote bloqueado por calidad")}><Lock className="h-4 w-4 mr-1" />Bloquear</Button>
              <Button disabled={busy || lot.sale_released} onClick={() => run(() => releaseLot(lot.id, "Liberado desde la ficha"), "Lote liberado para la venta")}>
                {lot.sale_released ? "Ya liberado para la venta" : "Liberar para la venta"}</Button>
            </div>) : <p className="text-sm text-muted-foreground">Solo administración o encargado de beneficio.</p>}
          <p className="mt-3 text-xs text-muted-foreground">El café recién cosechado o en proceso no se puede reservar hasta liberarlo. Aprobar la calidad no lo libera por sí solo.</p>
        </Card>

        <Card title="Reservas y entregas">
          <ul className="text-sm space-y-2 mb-3">{res.map((r) => (
            <li key={r.id} className="rounded-lg border border-border p-2 flex flex-wrap items-center justify-between gap-2">
              <span>{custName(r.customer_id)} · {r.qty_kg} kg {r.price != null && `· ${r.price} ${r.currency}/kg`} · <b>{r.status}</b></span>
              {canSell && (r.status === "reservada" || r.status === "confirmada") && <span className="flex gap-1">
                {r.status === "reservada" && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => confirmReservation(r.id), "Confirmada")}>Confirmar</Button>}
                <Button size="sm" disabled={busy} onClick={() => run(() => deliverReservation(r.id, newOpKey("del")), "Entrega registrada")}>Entregar</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => cancelReservation(r.id, "Cancelada por usuario"), "Cancelada")}>Cancelar</Button></span>}
            </li>))}{res.length === 0 && <li className="text-muted-foreground">Sin reservas.</li>}</ul>
          {canSell && (
            <div className="grid gap-2 grid-cols-2">
              <select className={sel + " col-span-2"} value={resForm.customer} onChange={(e) => setResForm({ ...resForm, customer: e.target.value })}>
                <option value="">Cliente…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <Input inputMode="decimal" placeholder="kg" value={resForm.qty} onChange={(e) => setResForm({ ...resForm, qty: e.target.value })} />
              <div className="flex gap-1"><Input inputMode="decimal" placeholder="Precio por kg" value={resForm.price} onChange={(e) => setResForm({ ...resForm, price: e.target.value })} />
                <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={resForm.currency} onChange={(e) => setResForm({ ...resForm, currency: e.target.value })}><option>USD</option><option>CRC</option><option>EUR</option></select></div>
              <Label className="col-span-2 text-xs">Vence (opcional)</Label>
              <Input type="date" className="col-span-2" value={resForm.expires} onChange={(e) => setResForm({ ...resForm, expires: e.target.value })} />
              <Button className="col-span-2" disabled={busy || !resForm.customer || !resForm.qty} onClick={() => run(() => createReservation(lot.id, resForm.customer, Number(resForm.qty),
                resForm.price === "" ? null : Number(resForm.price), resForm.price === "" ? null : resForm.currency,
                resForm.expires ? new Date(resForm.expires + "T23:59:59").toISOString() : null, newOpKey("res")), "Reserva creada")}>Reservar ({lot.qty_free_kg} kg libres)</Button>
            </div>)}
        </Card>

        <Card title="Fotos y documentos">
          <ul className="text-sm space-y-1 mb-3">{files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2">
              <button className="underline text-left" onClick={async () => { try { window.open(await signedFileUrl(f.storage_path), "_blank", "noopener"); } catch (e) { toast.error(friendlyError(e)); } }}>
                {f.kind === "photo" ? "Foto" : f.kind === "certificate" ? "Certificado" : f.kind === "contract" ? "Contrato" : "Documento"}: {f.title}</button>
              {canSell && f.kind !== "contract" && <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={f.public_selected} onChange={async (e) => {
                const { error } = await supabase.from("files").update({ public_selected: e.target.checked }).eq("id", f.id);
                if (error) toast.error(friendlyError(error)); else void load();
              }} />en ficha pública</label>}
              {f.kind === "contract" && <span className="text-xs text-muted-foreground">privado siempre</span>}
            </li>))}{files.length === 0 && <li className="text-muted-foreground">Sin archivos.</li>}</ul>
          {role !== "consulta" && (
            <div className="grid gap-2">
              <select className={sel} value={fileForm.kind} onChange={(e) => setFileForm({ ...fileForm, kind: e.target.value })}>
                <option value="photo">Foto de fase</option><option value="document">Documento</option><option value="certificate">Certificado</option><option value="contract">Contrato (privado)</option></select>
              <Input placeholder="Título" value={fileForm.title} onChange={(e) => setFileForm({ ...fileForm, title: e.target.value })} />
              <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFileForm({ ...fileForm, file: e.target.files?.[0] ?? null })} />
              <Button variant="outline" disabled={busy || !fileForm.file} onClick={() => run(() => uploadLotFile(lot.id, running?.id ?? null, fileForm.kind, fileForm.title, fileForm.file!), "Archivo subido")}>
                <FileUp className="h-4 w-4 mr-1" />Subir (máx. 10 MB)</Button>
            </div>)}
        </Card>

        <Card title="Ficha pública y QR">
          {canSell ? (
            <div className="grid gap-2">
              <Textarea rows={2} placeholder="Historia corta" value={pub.story} onChange={(e) => setPub({ ...pub, story: e.target.value })} />
              <Input placeholder="Notas de taza" value={pub.notes} onChange={(e) => setPub({ ...pub, notes: e.target.value })} />
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={pub.measurements} onChange={(e) => setPub({ ...pub, measurements: e.target.checked })} />Mostrar mediciones del proceso</label>
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={pub.producer} onChange={(e) => setPub({ ...pub, producer: e.target.checked })} />Mostrar nombre del productor</label>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => run(() => publishLot(lot.id, true, pub.story || null, pub.notes || null, { measurements: pub.measurements, producer: pub.producer }), "Ficha publicada")}>Publicar</Button>
                {profile?.is_public && <Button variant="outline" disabled={busy} onClick={() => run(() => publishLot(lot.id, false, null, null, profile.visibility), "Ficha retirada")}>Retirar</Button>}
              </div>
            </div>) : null}
          {profile?.is_public && publicUrl ? (
            <div className="mt-3 flex items-center gap-3"><QRCodeSVG value={publicUrl} size={96} />
              <div className="text-xs break-all"><a className="underline" href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
                <p className="text-muted-foreground mt-1">Muestra solo origen, proceso y lo que elijas. Nunca inventario, clientes ni precios.</p></div></div>
          ) : <p className="mt-3 text-sm text-muted-foreground">No publicada: el enlace responde “no encontrado”.</p>}
          {canSell && profile && (
            <div className="mt-3 grid gap-1">
              <span className="text-xs text-muted-foreground">Fecha real de exportación (solo si ya se exportó). {profile.exported_at ? `Declarada: ${new Date(profile.exported_at).toLocaleDateString()}` : "Sin declarar: la ficha no muestra fecha de exportación."}</span>
              <div className="flex gap-2">
                <Input type="date" max={new Date().toISOString().slice(0, 10)} value={exportDate} onChange={(e) => setExportDate(e.target.value)} />
                <Button variant="outline" disabled={busy || !exportDate} onClick={() => run(() => declareLotExport(lot.id, new Date(`${exportDate}T12:00:00Z`).toISOString()), "Exportación declarada")}>Declarar</Button>
                {profile.exported_at && <Button variant="ghost" disabled={busy} onClick={() => run(() => declareLotExport(lot.id, null), "Fecha retirada")}>Quitar</Button>}
              </div>
            </div>)}
        </Card>

        <Card title="Sacos con QR">
          <p className="text-sm mb-2">{sacks.length} sacos registrados.</p>
          {role !== "consulta" && role !== "productor" && (
            <div className="flex flex-wrap gap-2 mb-3">
              <Input className="w-24" inputMode="numeric" placeholder="Cantidad" value={sackForm.count} onChange={(e) => setSackForm({ ...sackForm, count: e.target.value })} />
              <Input className="w-24" inputMode="decimal" placeholder="kg/saco" value={sackForm.weight} onChange={(e) => setSackForm({ ...sackForm, weight: e.target.value })} />
              <Button variant="outline" disabled={busy || !sackForm.count} onClick={() => run(() => createSacks(lot.id, Number(sackForm.count), sackForm.weight ? Number(sackForm.weight) : null), "Sacos creados")}>Crear sacos</Button>
            </div>)}
          {sacks.length > 0 && <Button size="sm" onClick={() => void sackLabelsPdf(lot, sacks, window.location.origin)}><Download className="h-4 w-4 mr-1" />Etiquetas PDF</Button>}
          <p className="mt-2 text-xs text-muted-foreground">Cada saco tiene un código propio. Su QR abre el origen del lote solo si la ficha está publicada.</p>
        </Card>
      </div>
    </>
  );
}

type QRow = { status: string; score: number | null; sampled_at: string; data: QualityData | null; source_code?: string | null };
/** Own samples plus samples of source lots (split/merge), each tagged with the source lot code. */
async function lotQualityWithLineage(l: { id: string; organization_id: string }, lin: { sources?: { lot_code: string }[]; phases?: { lot_code: string; inherited: boolean }[] } | null): Promise<QRow[]> {
  const codes = [...new Set([...(lin?.sources ?? []).map((x) => x.lot_code), ...(lin?.phases ?? []).filter((x) => x.inherited).map((x) => x.lot_code)])];
  const anc = codes.length ? ((await supabase.from("lots").select("id,lot_code").eq("organization_id", l.organization_id).in("lot_code", codes)).data ?? []) : [];
  const code = new Map(anc.map((a) => [a.id, a.lot_code]));
  const { data } = await supabase.from("quality_samples").select("lot_id,status,score,sampled_at,data").in("lot_id", [l.id, ...code.keys()]).order("sampled_at");
  return ((data ?? []) as (QRow & { lot_id: string })[]).map((x) => ({ ...x, source_code: x.lot_id === l.id ? null : code.get(x.lot_id) ?? null }));
}
