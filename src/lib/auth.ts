import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setCurrentRole, type AppRole } from "@/lib/permissions";

// Session + role loaded from Lovable Cloud. The role in the database is the
// source of truth; the UI permission matrix reads it via setCurrentRole.

const ROLE_PRIORITY: AppRole[] = ["administrador", "encargado_beneficio", "comercial", "productor", "consulta"];

let session: Session | null = null;
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function loadRole(userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  setCurrentRole(ROLE_PRIORITY.find((r) => roles.includes(r)) ?? "consulta");
}

let started = false;
export function startAuth() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.getSession().then(async ({ data }) => {
    session = data.session;
    if (session) await loadRole(session.user.id);
    ready = true;
    emit();
  });
  supabase.auth.onAuthStateChange((event, s) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    session = s;
    if (s) void loadRole(s.user.id);
    else setCurrentRole("consulta");
    emit();
  });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useSession() {
  return useSyncExternalStore(subscribe, () => session, () => null);
}
export function useAuthReady() {
  return useSyncExternalStore(subscribe, () => ready, () => false);
}

export async function signOut() {
  await supabase.auth.signOut();
}
