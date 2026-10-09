import type { ReactNode } from "react";
import { FlaskConical, FileText, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCloudState } from "@/lib/cloud";
import {
  chooseEvaluationSpace, isEvaluatorAccount, reopenEvaluationChooser, useEvalChosen, useMemberships,
} from "@/lib/auth";

/** Evaluation account: shows the environment chooser until one is picked, then a permanent banner. */
export function EvaluationGate({ children }: { children: ReactNode }) {
  const ms = useMemberships();
  const chosen = useEvalChosen();
  const cloud = useCloudState();
  if (!isEvaluatorAccount(ms)) return <>{children}</>;
  const active = ms.find((m) => m.organization_id === cloud.orgId);

  if (!chosen) {
    const blank = ms.find((m) => m.eval_kind === "blank");
    const sample = ms.find((m) => m.eval_kind === "sample");
    return (
      <div className="max-w-3xl mx-auto py-10">
        <p className="eyebrow mb-2">Entorno de evaluación</p>
        <h1 className="font-serif text-3xl mb-2">¿Cómo quieres recorrer Bitácora Café Pro?</h1>
        <p className="text-muted-foreground mb-8">Son dos espacios separados. Lo que hagas en uno no aparece en el otro y se conserva si vuelves a cambiar.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {blank && (
            <button type="button" onClick={() => void chooseEvaluationSpace(blank.organization_id)}
              className="text-left rounded-xl border border-border bg-card p-6 hover:border-primary transition-colors">
              <FileText className="h-6 w-6 mb-3 text-primary" />
              <h2 className="font-serif text-xl mb-1">Bitácora Café Pro en blanco</h2>
              <p className="text-sm text-muted-foreground">Empieza desde cero: solo unidades y plantillas de proceso. Registra tu primera finca, cosecha y lote.</p>
            </button>)}
          {sample && (
            <button type="button" onClick={() => void chooseEvaluationSpace(sample.organization_id)}
              className="text-left rounded-xl border border-border bg-card p-6 hover:border-primary transition-colors">
              <Database className="h-6 w-6 mb-3 text-primary" />
              <h2 className="font-serif text-xl mb-1">Bitácora Café Pro con datos de ejemplo</h2>
              <p className="text-sm text-muted-foreground">Fincas, cosechas, procesos, calidad, reservas, ventas y trazabilidad ficticias para ver todos los módulos.</p>
            </button>)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm">
        <FlaskConical className="h-4 w-4 text-primary" />
        <span><b>Entorno de evaluación</b> · {active?.eval_kind === "sample" ? "Con datos de ejemplo (ficticios)" : "En blanco"}</span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={reopenEvaluationChooser}>Cambiar entorno</Button>
      </div>
      {children}
    </>
  );
}
