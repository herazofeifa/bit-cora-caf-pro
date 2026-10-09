import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Evaluation account for the graduation committee: ONE account, member (administrador) only of the
// two evaluation organizations. Provisioning is idempotent in the database (provision_evaluation).

const input = z.object({
  organizationId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(100),
  password: z.string().min(10).max(72),
});

type Ctx = { supabase: any; userId: string }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function assertRealOrgAdmin(ctx: Ctx, org: string) {
  const { data: isAdmin, error } = await ctx.supabase.rpc("has_org_role", { _org: org, _roles: ["administrador"] });
  if (error || isAdmin !== true) throw new Error("Solo un administrador de la organización original puede hacerlo.");
  const { data: o } = await ctx.supabase.from("organizations").select("is_demo, eval_kind").eq("id", org).maybeSingle();
  if (!o || o.is_demo || o.eval_kind) throw new Error("Hazlo desde la organización original, no desde un entorno demo.");
}

/** Minimal one-page text PDF (no external library; runs on the edge runtime). */
function textPdf(lines: string[]): Uint8Array {
  const esc = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\\()]/g, (m) => "\\" + m);
  const content = "BT /F1 14 Tf 60 780 Td 18 TL " + lines.map((l) => `(${esc(l)}) '`).join(" ") + " ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n"; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

async function uploadSampleFiles(files: { id: string; path: string; kind: string }[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const warnings: string[] = [];
  const origin = new URL(getRequest().url).origin;
  for (const f of files) {
    let body: Uint8Array; let type: string;
    if (f.kind === "photo") {
      const r = await fetch(`${origin}/eval/ejemplo-secado.jpg`);
      if (!r.ok) { warnings.push("No se pudo obtener la foto de ejemplo"); continue; }
      body = new Uint8Array(await r.arrayBuffer()); type = "image/jpeg";
    } else if (f.kind === "certificate") {
      body = textPdf(["Certificado de origen - FICTICIO", "Bitacora Cafe Pro - entorno de evaluacion", "Finca El Mirador (ejemplo), Tarrazu, Costa Rica",
        "Este documento es de demostracion y no tiene validez."]); type = "application/pdf";
    } else {
      body = textPdf(["Contrato de venta - FICTICIO Y PRIVADO", "Nordic Roasters (ficticio)", "30 kg a USD 6,80/kg",
        "Documento de demostracion: nunca se publica."]); type = "application/pdf";
    }
    const up = await supabaseAdmin.storage.from("lot-files").upload(f.path, body, { contentType: type, upsert: true });
    if (up.error) { warnings.push(`Archivo ${f.kind}: ${up.error.message}`); continue; }
    await supabaseAdmin.from("files").update({ size_bytes: body.byteLength }).eq("id", f.id);
  }
  return warnings;
}

/** Creates (once) the two evaluation spaces and the single evaluator account. */
export const provisionEvaluator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertRealOrgAdmin(ctx, data.organizationId);
    const { data: existing } = await ctx.supabase.from("evaluation_spaces").select("evaluator_user").eq("source_org", data.organizationId).maybeSingle();
    if (existing?.evaluator_user) throw new Error("La cuenta evaluadora ya existe. Usa «Cambiar contraseña» si la necesitas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true, user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear la cuenta");
    const uid = created.user.id;
    let result: { blank_org: string; sample_org: string; created: boolean; sample_files: { id: string; path: string; kind: string }[] };
    try {
      const { error: urErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "consulta" });
      if (urErr) throw new Error(urErr.message);
      const { data: res, error: pErr } = await ctx.supabase.rpc("provision_evaluation", { _source_org: data.organizationId, _evaluator: uid });
      if (pErr) throw new Error(pErr.message);
      result = res;
    } catch (e) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
      await supabaseAdmin.auth.admin.deleteUser(uid);
      console.error("provisionEvaluator rolled back", e);
      throw new Error(`No se completó: ${(e as Error).message}. La cuenta no quedó creada.`);
    }
    const warnings = await uploadSampleFiles(result.sample_files ?? []);
    return { ok: true, created: result.created, warnings };
  });

/** Status for the Settings card (no secrets). */
export const evaluationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: row } = await ctx.supabase.from("evaluation_spaces").select("evaluator_user, created_at").eq("source_org", data.organizationId).maybeSingle();
    if (!row) return { exists: false as const };
    let email: string | null = null;
    if (row.evaluator_user) {
      await assertRealOrgAdmin(ctx, data.organizationId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.evaluator_user);
      email = u.user?.email ?? null;
    }
    return { exists: true as const, email, created_at: row.created_at as string };
  });

/** Lets the author set a new evaluator password (typed by the author; never stored by the app). */
export const setEvaluatorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid(), password: z.string().min(10).max(72) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertRealOrgAdmin(ctx, data.organizationId);
    const { data: row } = await ctx.supabase.from("evaluation_spaces").select("evaluator_user").eq("source_org", data.organizationId).maybeSingle();
    if (!row?.evaluator_user) throw new Error("Aún no existe la cuenta evaluadora.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.evaluator_user, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
