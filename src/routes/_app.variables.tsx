import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Beaker, Plus, Search, Pencil, Trash2, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deactivateVariableDefinition, useStore } from "@/lib/store";
import type { VariableCategory, VariableValueType } from "@/types/domain";

export const Route = createFileRoute("/_app/variables")({
  head: () => ({
    meta: [
      { title: "Variables — Bitácora Café Pro" },
      { name: "description", content: "Gestiona variables de calidad y proceso." },
    ],
  }),
  component: VariablesPage,
});

const CATEGORY_LABEL: Record<VariableCategory, string> = {
  humedad: "Humedad",
  temperatura: "Temperatura",
  fermentacion: "Fermentación",
  fisica: "Física",
  secado: "Secado",
  ambiente: "Ambiente",
  sensorial: "Sensorial",
  general: "General",
};

const VALUE_TYPE_LABEL: Record<VariableValueType, string> = {
  number: "Número",
  percentage: "Porcentaje",
  short_text: "Texto corto",
  long_text: "Texto largo",
  single_select: "Opción única",
  multi_select: "Múltiple",
  boolean: "Sí/No",
  datetime: "Fecha/hora",
  photo: "Foto",
  file: "Archivo",
  scale_5: "Escala 1-5",
  custom_unit: "Unidad personalizada",
};

function VariablesPage() {
  const definitions = useStore((s) => s.variableDefinitions);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [valueType, setValueType] = useState<string>("all");
  const [origin, setOrigin] = useState<string>("all");

  const filtered = useMemo(() => {
    return definitions.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (category !== "all" && d.category !== category) return false;
      if (valueType !== "all" && d.value_type !== valueType) return false;
      if (origin === "default" && !d.is_default) return false;
      if (origin === "custom" && d.is_default) return false;
      return true;
    });
  }, [definitions, q, category, valueType, origin]);

  const grouped = useMemo(() => {
    const map = new Map<VariableCategory, typeof filtered>();
    for (const d of filtered) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <>
      <PageHeader
        title="Variables"
        subtitle="Crea, ajusta y organiza las variables que registras en cada fase."
        action={
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link to="/variables/log">
                <ListPlus className="h-4 w-4 mr-1.5" /> Registrar
              </Link>
            </Button>
            <Button asChild>
              <Link to="/variables/new">
                <Plus className="h-4 w-4 mr-1.5" /> Nueva variable
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar variable…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={origin} onValueChange={setOrigin}>
          <SelectTrigger><SelectValue placeholder="Origen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Default + Personalizadas</SelectItem>
            <SelectItem value="default">Solo default</SelectItem>
            <SelectItem value="custom">Solo personalizadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Beaker}
          title="Sin variables"
          description="Aún no hay variables que coincidan con tu búsqueda."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, defs]) => (
            <section key={cat}>
              <h2 className="mb-2 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {CATEGORY_LABEL[cat]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {defs.map((d) => (
                  <Card key={d.id}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold leading-tight">{d.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {VALUE_TYPE_LABEL[d.value_type]}{d.unit ? ` · ${d.unit}` : ""}
                          </p>
                        </div>
                        <Badge variant={d.is_default ? "secondary" : "outline"} className="text-[10px] shrink-0">
                          {d.is_default ? "Default" : "Personalizada"}
                        </Badge>
                      </div>
                      {(d.ideal_min != null || d.ideal_max != null) && (
                        <div className="text-xs text-muted-foreground">
                          Ideal: {d.ideal_min ?? "—"} a {d.ideal_max ?? "—"} {d.unit ?? ""}
                        </div>
                      )}
                      {d.phase_associations.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {d.phase_associations.map((ph) => (
                            <Badge key={ph} variant="outline" className="text-[10px]">{ph}</Badge>
                          ))}
                        </div>
                      )}
                      {d.alert_if_missing && (
                        <Badge className="text-[10px] bg-warning text-warning-foreground">Requerida</Badge>
                      )}
                      {!d.is_default && (
                        <div className="flex gap-1.5 pt-1 border-t border-border/40">
                          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                            <Link to="/variables/new" search={{ id: d.id }}>
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive"
                            onClick={() => {
                              if (confirm(`¿Desactivar "${d.name}"?`)) {
                                deactivateVariableDefinition(d.id);
                                toast.success("Variable desactivada");
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
