import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["administrador", "encargado_beneficio", "productor", "comercial", "consulta"] as const;

const newUser = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(100),
});

/**
 * Admin only: creates a team account in the organization chosen in the UI.
 * The caller must be administrador of THAT organization (has_org_role, checked server-side).
 * If any step after creating the auth account fails, the account is deleted (compensation).
 */
export const createTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => newUser.extend({ role: z.enum(ROLES), organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: rErr } = await context.supabase.rpc("has_org_role", {
      _org: data.organizationId, _roles: ["administrador"],
    });
    if (rErr || isAdmin !== true) throw new Error("Solo un administrador de esta organización puede crear usuarios.");
    const { data: org, error: oErr } = await context.supabase
      .from("organizations").select("id, is_demo").eq("id", data.organizationId).maybeSingle();
    if (oErr || !org) throw new Error("Organización no encontrada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el usuario");
    const newId = created.user.id;
    try {
      const { error: memErr } = await supabaseAdmin.from("memberships").insert({
        organization_id: org.id, user_id: newId, role: data.role,
      });
      if (memErr) throw new Error(memErr.message);
      // Legacy global role mirror: demo accounts stay least-privileged.
      const { error: urErr } = await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: org.is_demo ? "consulta" : data.role });
      if (urErr) throw new Error(urErr.message);
      const { error: aErr } = await supabaseAdmin.from("audit_log").insert({
        organization_id: org.id, actor_id: context.userId,
        entity: "memberships", entity_id: newId, action: "create", diff: { role: data.role, email: data.email },
      });
      if (aErr) throw new Error(aErr.message);
    } catch (e) {
      // Compensation: never leave an account without its membership.
      await supabaseAdmin.from("memberships").delete().eq("user_id", newId).eq("organization_id", org.id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
      await supabaseAdmin.auth.admin.deleteUser(newId);
      console.error("createTeamUser rolled back", e);
      throw new Error("No se pudo completar el alta; la cuenta no quedó creada.");
    }
    return { ok: true };
  });
