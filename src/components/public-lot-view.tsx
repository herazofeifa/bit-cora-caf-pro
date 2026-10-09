import { fmtDay, fmtDate } from "@/lib/org-data";
import { Award, Calendar, Droplet, MapPin, Mountain, Sprout } from "lucide-react";

export interface PublicLot {
  lot_code: string; name: string; variety: string | null; process: string; physical_state: string;
  story: string | null; tasting_notes: string | null;
  farm: { name: string; region: string | null; country: string; altitude_m: number | null } | null;
  parcel: { name: string; altitude_m: number | null } | null; producer: string | null;
  harvest: { first: string | null; last: string | null; season: string | null } | null;
  phases: { name: string; started_at: string; ended_at: string | null; inherited?: boolean }[];
  origins?: { farm: string | null; region: string | null; country: string; parcel: string | null; altitude_m: number | null; producer: string | null }[];
  is_blend?: boolean;
  measurements: { label: string; value: number; unit: string | null; at: string }[] | null;
  moisture: number | null; quality: { score: number | null; notes: string | null; cupping?: string | null; at: string; sca?: Record<string, number> | null; defects?: { primary?: number | null; secondary?: number | null } | null } | null;
  files: { id: string; kind: string; title: string; mime: string; url?: string }[]; exported_at: string | null; generated_at?: string;
}

import { SCA_ATTRS as SCA } from "@/components/quality-form";
const PROCESS: Record<string, string> = { lavado: "Lavado", honey: "Honey", natural: "Natural", anaerobico: "Anaeróbico" };
const Row = ({ icon: I, label, value }: { icon: typeof MapPin; label: string; value: React.ReactNode }) =>
  value ? <div className="flex gap-3 py-2 border-b border-border"><I className="h-5 w-5 text-muted-foreground shrink-0" /><div><div className="eyebrow">{label}</div><div>{value}</div></div></div> : null;

export function PublicLotView({ lot }: { lot: PublicLot }) {
  const photos = lot.files.filter((f) => f.mime.startsWith("image/") && f.url);
  const docs = lot.files.filter((f) => !f.mime.startsWith("image/") && f.url);
  return (
    <div className="space-y-6">
      <header className="text-center space-y-2">
        <span className="eyebrow">Trazabilidad · {lot.lot_code}</span>
        <h1 className="font-serif text-3xl md:text-5xl italic">{lot.name}</h1>
        <p className="text-muted-foreground">{[lot.variety, PROCESS[lot.process] ?? lot.process].filter(Boolean).join(" · ")}</p>
      </header>
      {photos.length > 0 && <div className="grid grid-cols-2 gap-2">{photos.map((p) => <img key={p.id} src={p.url} alt={p.title} className="rounded-lg aspect-square object-cover w-full" loading="lazy" />)}</div>}
      {lot.story && <p className="font-serif text-lg leading-relaxed">{lot.story}</p>}
      {(lot.origins?.length ?? 0) > 1 && (
        <section className="rounded-xl border border-border bg-card p-4"><h2 className="font-serif text-xl mb-2">{lot.is_blend ? "Mezcla de varios orígenes" : "Orígenes"}</h2>
          <ul className="text-sm space-y-1">{lot.origins!.map((o, i) => <li key={i}>{[o.farm, o.parcel, o.region, o.country].filter(Boolean).join(" · ")}{o.altitude_m ? ` · ${o.altitude_m} m s. n. m.` : ""}{o.producer ? ` · ${o.producer}` : ""}</li>)}</ul></section>)}
      <div className="rounded-xl border border-border bg-card p-4">
        <Row icon={MapPin} label="Finca" value={lot.farm && `${lot.farm.name}${lot.farm.region ? `, ${lot.farm.region}` : ""} · ${lot.farm.country}`} />
        <Row icon={Sprout} label="Parcela" value={lot.parcel?.name} />
        <Row icon={Mountain} label="Altitud" value={(lot.parcel?.altitude_m ?? lot.farm?.altitude_m) ? `${lot.parcel?.altitude_m ?? lot.farm?.altitude_m} m s. n. m.` : null} />
        <Row icon={Sprout} label="Productor" value={lot.producer} />
        <Row icon={Calendar} label="Cosecha" value={lot.harvest?.first && `${lot.harvest.first}${lot.harvest.last && lot.harvest.last !== lot.harvest.first ? ` a ${lot.harvest.last}` : ""}${lot.harvest.season ? ` · temporada ${lot.harvest.season}` : ""}`} />
        <Row icon={Droplet} label="Humedad" value={lot.moisture != null ? `${lot.moisture}%` : null} />
        <Row icon={Award} label="Puntaje SCA" value={lot.quality?.score != null ? `${lot.quality.score}${lot.quality.notes ? ` · ${lot.quality.notes}` : ""}` : null} />
        <Row icon={Award} label="Perfil sensorial SCA" value={lot.quality?.sca ? SCA.filter(([k]) => lot.quality!.sca![k] != null).map(([k, l]) => `${l} ${lot.quality!.sca![k]}`).join(" · ") : null} />
        <Row icon={Award} label="Defectos" value={lot.quality?.defects && (lot.quality.defects.primary != null || lot.quality.defects.secondary != null) ? `${lot.quality.defects.primary ?? 0} primarios · ${lot.quality.defects.secondary ?? 0} secundarios` : null} />
        <Row icon={Award} label="Notas de taza" value={lot.tasting_notes ?? lot.quality?.cupping} />
      </div>
      {lot.phases.length > 0 && (
        <section><h2 className="font-serif text-xl mb-2">Proceso</h2>
          <ol className="border-l border-border ml-2 space-y-3">{lot.phases.map((p, i) => (
            <li key={i} className="pl-4"><div className="font-medium">{p.name}{p.inherited && <span className="text-xs text-muted-foreground"> · lote de origen</span>}</div>
              <div className="text-xs text-muted-foreground">{fmtDay(p.started_at)}{p.ended_at ? ` – ${fmtDay(p.ended_at)}` : " · en curso"}</div></li>))}</ol>
        </section>)}
      {lot.measurements && lot.measurements.length > 0 && (
        <section><h2 className="font-serif text-xl mb-2">Mediciones</h2>
          <ul className="text-sm grid grid-cols-2 gap-1">{lot.measurements.map((m, i) => <li key={i}>{m.label}: {m.value} {m.unit}</li>)}</ul></section>)}
      {docs.length > 0 && (
        <section><h2 className="font-serif text-xl mb-2">Certificados y documentos</h2>
          <ul className="text-sm">{docs.map((d) => <li key={d.id}><a className="underline" href={d.url} target="_blank" rel="noreferrer">{d.title}</a></li>)}</ul></section>)}
      {lot.exported_at && <p className="text-sm text-center">Exportado el {fmtDay(lot.exported_at)}</p>}
      <p className="text-xs text-muted-foreground text-center">Información publicada por el productor{lot.generated_at ? ` · ficha generada ${fmtDate(lot.generated_at)}` : ""}</p>
    </div>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-background px-4 py-10"><div className="max-w-xl mx-auto">{children}</div></main>;
}
export function PublicNotFound() {
  return <PublicShell><div className="text-center space-y-2 py-20"><h1 className="font-serif text-3xl">No encontrado</h1>
    <p className="text-muted-foreground">Este código no existe o su ficha no está publicada.</p></div></PublicShell>;
}
