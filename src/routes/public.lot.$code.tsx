import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Coffee,
  MapPin,
  Sprout,
  Calendar,
  Droplet,
  Award,
  Leaf,
  Sun,
  Copy,
  Download,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { mockDb } from "@/data/mock-data";
import { useFarms, useParcels } from "@/lib/app-config-store";
import { useStore, useLotPublicProfile } from "@/lib/store";
import {
  calcAvailableKg,
  formatKg,
  physicalStateLabel,
  qualityStatusLabel,
  qualityTone,
  phaseDurationDays,
} from "@/lib/helpers";
import type { Lot, LotPublicProfile } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/public/lot/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Lote ${params.code} — Bitácora Café Pro` },
      { name: "description", content: `Trazabilidad pública del lote ${params.code}.` },
      { property: "og:title", content: `Lote ${params.code}` },
      { property: "og:description", content: "Conoce la historia de este lote de café." },
      { property: "og:type", content: "article" },
    ],
  }),
  component: PublicLotPage,
});

const PROCESS_LABEL: Record<string, string> = {
  lavado: "Lavado",
  honey: "Honey",
  natural: "Natural",
  anaerobico: "Anaeróbico",
  experimental: "Experimental",
  custom: "Personalizado",
};

function PublicLotPage() {
  const { code } = useParams({ from: "/public/lot/$code" });
  const lot = useStore((s) => s.lots.find((l) => l.lot_code.toLowerCase() === code.toLowerCase()));
  const profile = useLotPublicProfile(lot?.id ?? "__none__");

  if (!lot) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Coffee className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <h1 className="font-display text-2xl font-semibold">Lote no encontrado</h1>
          <p className="text-sm text-muted-foreground mt-2">
            El código <span className="font-mono">{code}</span> no corresponde a ningún lote público.
          </p>
        </div>
      </div>
    );
  }

  if (!profile.is_public) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h1 className="font-display text-2xl font-semibold">Ficha privada</h1>
          <p className="text-sm text-muted-foreground mt-2">
            El productor no ha publicado la ficha de este lote.
          </p>
        </div>
      </div>
    );
  }

  return <PublicLotContent lot={lot} profile={profile} />;
}

function PublicLotContent({
  lot,
  profile,
}: {
  lot: Lot;
  profile: LotPublicProfile;
}) {
  const farm = useFarms().find((f) => f.id === lot.farm_id);
  const parcel = useParcels().find((p) => p.id === lot.parcel_id);
  const harvest = mockDb.harvestTickets.find((h) => h.id === lot.harvest_ticket_id);
  const processInstance = mockDb.processInstances.find((p) => p.id === lot.process_instance_id);
  const phases = useStore((s) => s.phases.filter((p) => p.process_instance_id === lot.process_instance_id));

  const tastingFromQc = useMemo(() => {
    const qc = mockDb.qualitySamples.find((q) => q.lot_id === lot.id && q.tasting_notes);
    return qc?.tasting_notes ?? null;
  }, [lot.id]);

  const tasting = profile.tasting_notes ?? tastingFromQc;

  const dryingPhase = phases.find((p) => /secado/i.test(p.name));
  const dryingDays = dryingPhase
    ? Math.round(phaseDurationDays(dryingPhase) * 10) / 10
    : null;

  const url = typeof window !== "undefined" ? window.location.href : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  };

  const downloadSheet = () => {
    const lines = [
      `LOTE ${lot.lot_code}`,
      `Productor: ${lot.producer_name ?? "—"}`,
      `Finca: ${farm?.name ?? "—"}`,
      `Región: ${lot.region ?? "—"}`,
      `Altitud: ${lot.altitude_m ? `${lot.altitude_m} m` : "—"}`,
      `Variedad: ${lot.variety}`,
      `Proceso: ${PROCESS_LABEL[lot.process_type] ?? lot.process_type}`,
      `Cosecha: ${harvest?.harvest_date ?? "—"}`,
      profile.show_moisture && lot.current_moisture != null ? `Humedad final: ${lot.current_moisture}%` : null,
      profile.show_quality ? `Calidad: ${qualityStatusLabel[lot.quality_status]}` : null,
      profile.show_tasting_notes && tasting ? `Notas: ${tasting}` : null,
      profile.short_story ? `\nHistoria: ${profile.short_story}` : null,
      `\nFicha pública: ${url}`,
    ].filter(Boolean) as string[];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${lot.lot_code}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="text-center mb-10 md:mb-14">
          <span className="eyebrow inline-block mb-5">Trazabilidad del lote</span>
          <p className="font-mono text-[11px] text-muted-foreground tracking-[0.2em]">{lot.lot_code}</p>
          <h1 className="mt-3 font-serif italic text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] tracking-tight">
            {lot.friendly_name}
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground">
            {lot.variety} · {PROCESS_LABEL[lot.process_type] ?? lot.process_type}
            {lot.is_custom_process && processInstance && " (proceso personalizado)"}
          </p>
        </header>

        {/* Photos */}
        {profile.show_photos && profile.photo_urls.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-6 sm:grid-cols-3">
            {profile.photo_urls.map((src: string, i: number) => (
              <div key={i} className="aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}

        {/* Origin card */}
        <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Origen
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Productor" value={lot.producer_name ?? "—"} />
            <Field label="Finca" value={farm?.name ?? "—"} />
            <Field label="Región" value={lot.region ?? farm?.region ?? "—"} />
            <Field label="País" value={farm?.country ?? "—"} />
            <Field label="Altitud" value={lot.altitude_m ? `${lot.altitude_m} m` : "—"} />
            {parcel && <Field label="Parcela" value={parcel.name} />}
            <Field
              label="Cosechado"
              value={harvest?.harvest_date ? new Date(harvest.harvest_date).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
            />
            <Field label="Variedad" value={lot.variety} />
          </dl>
        </section>

        {/* Process details */}
        {profile.show_process_details && (
          <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <Sprout className="h-4 w-4 text-primary" /> Proceso
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {PROCESS_LABEL[lot.process_type] ?? lot.process_type}
              {lot.is_custom_process && " (personalizado por el productor)"}
            </p>
            {phases.length > 0 ? (
              <ol className="space-y-3">
                {phases
                  .slice()
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((p) => (
                    <li key={p.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                          {p.order_index}
                        </div>
                        {p !== phases[phases.length - 1] && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.started_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                          {p.ended_at &&
                            ` → ${new Date(p.ended_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}`}
                          {!p.ended_at && " · en curso"}
                        </p>
                      </div>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">El productor aún no ha registrado fases.</p>
            )}

            {dryingDays != null && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs">
                <Sun className="h-3.5 w-3.5 text-warning" /> Secado: {dryingDays} días
              </div>
            )}
          </section>
        )}

        {/* Quality + moisture */}
        {(profile.show_quality || profile.show_moisture) && (
          <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" /> Calidad
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.show_quality && (
                <StatusBadge status={qualityTone(lot.quality_status)}>
                  <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                  {qualityStatusLabel[lot.quality_status]}
                </StatusBadge>
              )}
              {profile.show_moisture && lot.current_moisture != null && (
                <StatusBadge status="info">
                  <Droplet className="h-3 w-3 mr-1 inline" /> Humedad {lot.current_moisture}%
                </StatusBadge>
              )}
              <StatusBadge status="neutral">
                <Leaf className="h-3 w-3 mr-1 inline" /> {physicalStateLabel[lot.physical_state]}
              </StatusBadge>
            </div>
          </section>
        )}

        {/* Tasting notes */}
        {profile.show_tasting_notes && tasting && (
          <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold mb-3">En taza</h2>
            <p className="text-sm leading-relaxed text-foreground/90 italic">"{tasting}"</p>
          </section>
        )}

        {/* Story */}
        {profile.short_story && (
          <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold mb-3">La historia</h2>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{profile.short_story}</p>
          </section>
        )}

        {/* Availability */}
        {profile.show_availability && (
          <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Disponibilidad
            </h2>
            <p className="text-2xl font-display font-semibold">{formatKg(calcAvailableKg(lot))}</p>
            <p className="text-xs text-muted-foreground mt-1">disponibles para negociar</p>
          </section>
        )}

        {/* QR + share */}
        <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold mb-4 text-center">Comparte este lote</h2>
          <div className="flex justify-center mb-4">
            <div className="rounded-2xl bg-white p-4 border border-border">
              <QRCodeSVG value={url} size={160} level="M" includeMargin={false} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar enlace
            </Button>
            <Button variant="outline" size="sm" onClick={downloadSheet}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar ficha
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-4 break-all">{url}</p>
        </section>

        <footer className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
          Trazabilidad por{" "}
          <Link to="/" className="text-primary hover:underline">
            Bitácora Café Pro
          </Link>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

