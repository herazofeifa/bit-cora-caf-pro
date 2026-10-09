import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCloudState } from "@/lib/cloud";
import { useMemberships } from "@/lib/auth";
import { evaluationStatus, provisionEvaluator, setEvaluatorPassword } from "@/lib/evaluation.functions";

/** Admin of the original organization: create the single evaluator account + both evaluation spaces. */
export function EvaluationAccountCard() {
  const orgId = useCloudState().orgId;
  const active = useMemberships().find((m) => m.organization_id === orgId);
  const status = useServerFn(evaluationStatus);
  const provision = useServerFn(provisionEvaluator);
  const setPwd = useServerFn(setEvaluatorPassword);
  const [info, setInfo] = useState<{ exists: boolean; email?: string | null } | null>(null);
  const [form, setForm] = useState({ email: "", full_name: "Evaluación docente", password: "" });
  const [pwd, setPwdValue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => { if (orgId) setInfo(await status({ data: { organizationId: orgId } })); };
  useEffect(() => { void load().catch(() => setInfo(null)); }, [orgId]);
  if (!orgId || active?.role !== "administrador" || active.is_demo || active.eval_kind) return null;

  return (
    <Card className="mt-6 p-5 rounded-2xl">
      <p className="eyebrow mb-1">Evaluación</p>
      <h3 className="font-serif text-xl mb-1">Cuenta para profesores</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Crea una sola cuenta que solo entra a dos espacios nuevos: «en blanco» y «con datos de ejemplo». No verá tus datos ni tu equipo.
      </p>
      {info?.exists && info.email ? (
        <div className="grid gap-3">
          <p className="text-sm">Ya existe: <b>{info.email}</b>. Los dos espacios están creados.</p>
          <div className="grid gap-1 max-w-sm">
            <Label htmlFor="ev-newpwd">Nueva contraseña (mín. 10)</Label>
            <Input id="ev-newpwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwdValue(e.target.value)} />
          </div>
          <Button className="w-fit" variant="outline" disabled={busy || pwd.length < 10} onClick={async () => {
            setBusy(true);
            try { await setPwd({ data: { organizationId: orgId, password: pwd } }); setPwdValue(""); toast.success("Contraseña actualizada"); }
            catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>Cambiar contraseña</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1"><Label htmlFor="ev-email">Correo</Label>
            <Input id="ev-email" type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid gap-1"><Label htmlFor="ev-name">Nombre</Label>
            <Input id="ev-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid gap-1"><Label htmlFor="ev-pwd">Contraseña (mín. 10)</Label>
            <Input id="ev-pwd" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <Button className="sm:col-span-3 w-fit" disabled={busy || !form.email || form.password.length < 10} onClick={async () => {
            setBusy(true);
            try {
              const r = await provision({ data: { organizationId: orgId, ...form } });
              setForm({ ...form, password: "" });
              toast.success("Cuenta y espacios de evaluación listos");
              r.warnings.forEach((w) => toast.warning(w));
              await load();
            } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>{busy ? "Creando… (puede tardar unos segundos)" : "Crear cuenta y espacios"}</Button>
        </div>
      )}
    </Card>
  );
}
