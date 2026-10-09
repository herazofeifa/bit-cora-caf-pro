import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["administrador", "encargado_beneficio", "productor", "comercial", "consulta"] as const;

/** Admin only: creates a team account with a role. */
export const createTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => newUser.extend({ role: z.enum(ROLES) }).parse(d))
  .handler(async ({ data, context }) => {
    // Role is read from the server-side membership of the caller, never from the client.
    const { data: mine, error: mErr } = await context.supabase.rpc("my_membership");
    const membership = mine?.[0];
    if (mErr || !membership || membership.role !== "administrador") {
      throw new Error("Solo un administrador puede crear usuarios.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el usuario");
    const { error: memErr } = await supabaseAdmin.from("memberships").insert({
      organization_id: membership.organization_id, user_id: created.user.id, role: data.role,
    });
    if (memErr) throw new Error(memErr.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    await supabaseAdmin.from("audit_log").insert({
      organization_id: membership.organization_id, actor_id: context.userId,
      entity: "memberships", entity_id: created.user.id, action: "create", diff: { role: data.role, email: data.email },
    });
    return { ok: true };
  });
