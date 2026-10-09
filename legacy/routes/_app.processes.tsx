import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Workflow,
  Plus,
  Copy,
  Pencil,
  PowerOff,
  Power,
  Eye,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  activateTemplate,
  deactivateTemplate,
  duplicateTemplate,
  useProcessTemplates,
} from "@/lib/process-store";
import { useStore } from "@/lib/store";
import type { ProcessBaseType, ProcessTemplateV2 } from "@/types/process";

export const Route = createFileRoute("/_app/processes")({
  head: () => ({
    meta: [
      { title: "Procesos — Bitácora Café Pro" },
      { name: "description", content: "Define y administra los procesos de tu beneficio." },
    ],
  }),
  component: ProcessesPage,
});

const BASE_LABEL: Record<ProcessBaseType, string> = {
  lavado: "Lavado",
  honey: "Honey",
  natural: "Natural",
  anaerobico_lavado: "Anaeróbico lavado",
  anaerobico_natural: "Anaeróbico natural",
  experimental: "Experimental",
  custom: "Personalizado",
};

const BASE_TO_LOT_TYPE: Partial<Record<ProcessBaseType, string>> = {
  lavado: "lavado",
  honey: "honey",
  natural: "natural",
  anaerobico_lavado: "anaerobico",
  anaerobico_natural: "anaerobico",
  experimental: "experimental",
  custom: "custom",
};

function ProcessesPage() {
  const templates = useProcessTemplates();
  const lots = useStore((s) => s.lots);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      [...templates].sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [templates],
  );

  const previewTpl = previewId ? templates.find((t) => t.id === previewId) : null;

  return (
    <>
      <PageHeader
        eyebrow="PROCESO" title="Procesos"
        subtitle="Plantillas listas para usar y procesos diseñados a tu medida."
        action={
          <Button asChild>
            <Link to="/processes/custom-builder">
              <Plus className="h-4 w-4 mr-2" /> Crear proceso
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-foreground/80">
          Podés empezar desde un proceso existente y ajustarlo a tu forma de trabajar.
          Los procesos por defecto no se borran, pero los podés duplicar y editar.
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Sin procesos"
          description="Crea tu primer proceso o duplica uno por defecto."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              activeLots={
                lots.filter((l) => l.process_type === BASE_TO_LOT_TYPE[tpl.base_type]).length
              }
              onPreview={() => setPreviewId(tpl.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!previewTpl} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {previewTpl && (
            <>
              <DialogHeader>
                <DialogTitle>{previewTpl.name}</DialogTitle>
                <DialogDescription>
                  {previewTpl.description ?? BASE_LABEL[previewTpl.base_type]}
                </DialogDescription>
              </DialogHeader>
              <PhaseTimelinePreview tpl={previewTpl} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemplateCard({
  tpl,
  activeLots,
  onPreview,
}: {
  tpl: ProcessTemplateV2;
  activeLots: number;
  onPreview: () => void;
}) {
  const handleDuplicate = () => {
    const copy = duplicateTemplate(tpl.id);
    if (copy) toast.success(`Duplicado como “${copy.name}”`);
  };
  const handleToggle = () => {
    if (tpl.is_default) {
      toast.error("Los procesos por defecto no se pueden desactivar.");
      return;
    }
    if (tpl.is_active) {
      deactivateTemplate(tpl.id);
      toast.success("Proceso desactivado");
    } else {
      activateTemplate(tpl.id);
      toast.success("Proceso activado");
    }
  };

  return (
    <Card className={!tpl.is_active ? "opacity-60" : ""}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {tpl.is_default ? (
                <Badge variant="secondary" className="text-[10px]">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Por defecto
                </Badge>
              ) : (
                <Badge className="text-[10px]">
                  <Sparkles className="h-3 w-3 mr-1" /> Personalizado
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">v{tpl.version}</Badge>
              {!tpl.is_active && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Inactivo
                </Badge>
              )}
            </div>
            <h3 className="mt-1.5 font-display text-lg font-semibold leading-tight truncate">
              {tpl.name}
            </h3>
            <p className="text-xs text-muted-foreground">{BASE_LABEL[tpl.base_type]}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1">
                <Pencil className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onPreview}>
                <Eye className="h-4 w-4 mr-2" /> Ver
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem asChild disabled={tpl.is_default}>
                <Link
                  to="/processes/custom-builder"
                  search={{ from: tpl.id, mode: "edit" as const }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {tpl.is_default ? "Editar (bloqueado)" : "Editar"}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleToggle} disabled={tpl.is_default}>
                {tpl.is_active ? (
                  <>
                    <PowerOff className="h-4 w-4 mr-2" /> Desactivar
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4 mr-2" /> Activar
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {tpl.description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{tpl.description}</p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Fases" value={String(tpl.phases.length)} />
          <Stat label="Lotes activos" value={String(activeLots)} />
          <Stat
            label="Actualizado"
            value={new Date(tpl.updated_at).toLocaleDateString("es", {
              day: "2-digit",
              month: "short",
            })}
          />
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onPreview}>
            <Eye className="h-4 w-4 mr-1.5" /> Ver
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={handleDuplicate}>
            <Copy className="h-4 w-4 mr-1.5" /> Duplicar
          </Button>
        </div>

        {tpl.is_default && (
          <p className="mt-3 inline-flex items-center text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3 mr-1" /> Plantilla protegida — duplicá para personalizar
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export function PhaseTimelinePreview({ tpl }: { tpl: ProcessTemplateV2 }) {
  return (
    <ol className="relative border-l-2 border-border ml-3 space-y-4 mt-2">
      {tpl.phases.map((p, i) => (
        <li key={p.id} className="ml-5">
          <span className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full ring-4 ring-background bg-primary/80 flex items-center justify-center text-[9px] font-semibold text-primary-foreground">
            {i + 1}
          </span>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="font-semibold text-sm">{p.name}</h4>
            <div className="flex items-center gap-1 flex-wrap">
              {!p.is_required && <Badge variant="outline" className="text-[9px]">Opcional</Badge>}
              {p.requires_approval && (
                <Badge variant="secondary" className="text-[9px]">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Aprobación
                </Badge>
              )}
              {p.allows_split && <Badge variant="outline" className="text-[9px]">Divide</Badge>}
              {p.allows_merge && <Badge variant="outline" className="text-[9px]">Mezcla</Badge>}
            </div>
          </div>
          {p.description && (
            <p className="text-xs text-muted-foreground">{p.description}</p>
          )}
          {(p.expected_duration != null || p.min_duration != null || p.max_duration != null) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {p.expected_duration != null && (
                <>Esperado: <span className="text-foreground">{p.expected_duration} {p.duration_unit}</span></>
              )}
              {p.min_duration != null && <> · Mín {p.min_duration}</>}
              {p.max_duration != null && <> · Máx {p.max_duration}</>}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
