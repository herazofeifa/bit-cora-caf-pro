import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["administrador", "encargado_beneficio", "productor", "comercial", "consulta"] as const;

/** Public: tells the login page whether the first administrator still has to be created. */
export const needsFirstAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "administrador");
  return { needed: (count ?? 0) === 0 };
});

const newUser = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(100),
});

/** Public but self-locking: only works while no administrator exists. */
export const createFirstAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) => newUser.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "administrador");
    if ((count ?? 0) > 0) throw new Error("Ya existe un administrador.");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin only: creates a team account with a role. */
export const createTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => newUser.extend({ role: z.enum(ROLES) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "administrador",
    });
    if (!isAdmin) throw new Error("Solo un administrador puede crear usuarios.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el usuario");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    if (roleErr) throw new Error(roleErr.message);
    return { ok: true };
  });
