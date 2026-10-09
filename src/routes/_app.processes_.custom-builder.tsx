import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section, selectCls } from "@/components/ops-ui";
import { sel, useOrgQuery } from "@/lib/org-data";
import { friendlyError, saveProcessTemplate } from "@/lib/ops-cloud";
import { useCurrentRole } from "@/lib/permissions";

export const Route = createFileRoute("/_app/processes_/custom-builder")({
  head: () => ({ meta: [
    { title: "Editor de plantillas de proceso — Bitácora Café Pro" },
    { name: "description", content: "Crea o edita procesos personalizados con fases, duración y variables; cada cambio guarda una versión nueva." },
    { property: "og:title", content: "Editor de plantillas — Bitácora Café Pro" },
    { property: "og:description", content: "Procesos personalizados con versiones." },
  ] }),
  component: Builder,
});

type V = { key: string; label: string; unit: string; min: string; max: string };
type Ph = { name: string; hours: string; variables: V[] };
type T = { id: string; name: string; process_type: string; description: string | null; version: number; active: boolean;
  phases: { name: string; expected_minutes?: number; variables?: { key: string; label?: string; unit?: string; min?: number; max?: number }[] }[] };

const blank = (): Ph => ({ name: "", hours: "", variables: [] });
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

function Builder() {
  const role = useCurrentRole(); const can = role === "administrador" || role === "encargado_beneficio";
  const tpl = useOrgQuery<T[]>("b-tpl", (o) => sel("process_templates", "*", o, "name", true), ["process_templates"], []);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState(""); const [type, setType] = useState("personalizado"); const [desc, setDesc] = useState("");
  const [phases, setPhases] = useState<Ph[]>([blank()]); const [busy, setBusy] = useState(false);

  const load = (t: T) => {
    setEditing(t.id); setName(t.name); setType(t.process_type); setDesc(t.description ?? "");
    setPhases(t.phases.map((p) => ({ name: p.name, hours: p.expected_minutes ? String(p.expected_minutes / 60) : "",
      variables: (p.variables ?? []).map((v) => ({ key: v.key, label: v.label ?? v.key, unit: v.unit ?? "", min: v.min?.toString() ?? "", max: v.max?.toString() ?? "" })) })));
  };
  const upd = (i: number, p: Partial<Ph>) => setPhases(phases.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => { const n = [...phases]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); setPhases(n); };

  async function save() {
    setBusy(true);
    try {
      const payload = phases.map((p) => ({ name: p.name.trim(), expected_minutes: p.hours ? Math.round(Number(p.hours) * 60) : undefined,
        variables: p.variables.filter((v) => v.label.trim()).map((v) => ({ key: v.key || slug(v.label), label: v.label.trim(), unit: v.unit || undefined,
          min: v.min === "" ? undefined : Number(v.min), max: v.max === "" ? undefined : Number(v.max) })) }));
      const t = (await saveProcessTemplate(editing, name, type, desc || null, payload)) as { id: string; version: number };
      toast.success(`Plantilla guardada como versión ${t.version}`); setEditing(t.id);
    } catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <Link to="/processes" className="text-sm text-muted-foreground mb-3 inline-block">← Procesos</Link>
      <PageHeader eyebrow="PROCESOS" title="Editor de plantillas" subtitle="Al guardar se crea una versión nueva; los lotes que ya usaron la anterior conservan su historia." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Plantillas activas">
          <ul className="space-y-2 text-sm">{tpl.data.filter((t) => t.active).map((t) => (
            <li key={t.id}><button className={"w-full text-left rounded-lg border p-2 " + (editing === t.id ? "border-primary" : "border-border")} onClick={() => load(t)}>
              {t.name} <span className="text-muted-foreground">· v{t.version} · {t.phases.length} fases</span></button></li>))}</ul>
          <Button variant="outline" className="mt-3 w-full" onClick={() => { setEditing(null); setName(""); setType("personalizado"); setDesc(""); setPhases([blank()]); }}><Plus className="h-4 w-4 mr-1" />Nueva plantilla</Button>
        </Section>
        <Section title={editing ? "Editar (se guardará como nueva versión)" : "Nueva plantilla"} className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2 mb-3">
            <Input placeholder="Nombre del proceso" value={name} onChange={(e) => setName(e.target.value)} />
            <select className={selectCls} value={type} onChange={(e) => setType(e.target.value)}>{["lavado", "honey", "natural", "anaerobico", "personalizado"].map((p) => <option key={p}>{p}</option>)}</select>
            <Input className="sm:col-span-2" placeholder="Descripción" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <ol className="space-y-3">{phases.map((p, i) => (
            <li key={i} className="rounded-xl border border-border p-3">
              <div className="flex gap-2 items-center">
                <span className="eyebrow w-6">{i + 1}</span>
                <Input placeholder="Nombre de la fase" value={p.name} onChange={(e) => upd(i, { name: e.target.value })} />
                <Input className="w-28" placeholder="Horas" inputMode="decimal" value={p.hours} onChange={(e) => upd(i, { hours: e.target.value })} />
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" disabled={i === phases.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" disabled={phases.length === 1} onClick={() => setPhases(phases.filter((_, j) => j !== i))} aria-label="Quitar fase"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-2 space-y-1 pl-8">{p.variables.map((v, k) => (
                <div key={k} className="flex flex-wrap gap-1">
                  <Input className="w-36" placeholder="Variable (ej. pH)" value={v.label} onChange={(e) => upd(i, { variables: p.variables.map((x, y) => (y === k ? { ...x, label: e.target.value, key: x.key || "" } : x)) })} />
                  <Input className="w-20" placeholder="Unidad" value={v.unit} onChange={(e) => upd(i, { variables: p.variables.map((x, y) => (y === k ? { ...x, unit: e.target.value } : x)) })} />
                  <Input className="w-20" placeholder="Mín" inputMode="decimal" value={v.min} onChange={(e) => upd(i, { variables: p.variables.map((x, y) => (y === k ? { ...x, min: e.target.value } : x)) })} />
                  <Input className="w-20" placeholder="Máx" inputMode="decimal" value={v.max} onChange={(e) => upd(i, { variables: p.variables.map((x, y) => (y === k ? { ...x, max: e.target.value } : x)) })} />
                  <Button size="icon" variant="ghost" onClick={() => upd(i, { variables: p.variables.filter((_, y) => y !== k) })} aria-label="Quitar variable"><Trash2 className="h-4 w-4" /></Button>
                </div>))}
                <Button size="sm" variant="ghost" onClick={() => upd(i, { variables: [...p.variables, { key: "", label: "", unit: "", min: "", max: "" }] })}><Plus className="h-3 w-3 mr-1" />Variable</Button>
              </div>
            </li>))}</ol>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" onClick={() => setPhases([...phases, blank()])}><Plus className="h-4 w-4 mr-1" />Fase</Button>
            {can ? <Button disabled={busy || !name.trim() || phases.some((p) => !p.name.trim())} onClick={save}>Guardar versión</Button>
              : <span className="text-sm text-muted-foreground self-center">Solo administración o encargado de beneficio puede guardar.</span>}
          </div>
        </Section>
      </div>
    </>
  );
}
