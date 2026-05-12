import { useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  acknowledgeAlert,
  evaluateReservationExpirations,
  evaluateTimeAlertsForActivePhases,
  useStore,
} from "@/lib/store";
import { alertTone } from "@/lib/helpers";

export const Route = createFileRoute("/_app/alerts")({
  head: () => ({
    meta: [
      { title: "Alertas — Bitácora Café Pro" },
      { name: "description", content: "Tiempo, calidad, inventario y proceso." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const alerts = useStore((s) => s.alerts);

  useEffect(() => {
    evaluateTimeAlertsForActivePhases();
    evaluateReservationExpirations();
  }, []);

  const open = useMemo(() => alerts.filter((a) => a.status === "open"), [alerts]);
  const recent = useMemo(() => alerts.filter((a) => a.status !== "open").slice(0, 30), [alerts]);

  return (
    <>
      <PageHeader eyebrow="ALERTAS" title="Alertas" subtitle="Tiempos, calidad, inventario y proceso." />

      <section className="mb-6">
        <h2 className="text-sm font-semibold mb-2">Activas ({open.length})</h2>
        {open.length === 0 ? (
          <EmptyState icon={Bell} title="Todo en orden por ahora" description="Cuando algo necesite tu atención, te avisamos acá." />
        ) : (
          <div className="space-y-2">
            {open.map((a) => (
              <article key={a.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={alertTone(a.severity)}>{a.severity}</StatusBadge>
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("es")}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { acknowledgeAlert(a.id); toast.success("Alerta reconocida"); }}>
                  <Check className="size-4" /> Reconocer
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Historial reciente</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {recent.map((a) => (
              <div key={a.id} className="p-3 text-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.message}</div>
                </div>
                <div className="text-xs text-muted-foreground">{a.status}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
