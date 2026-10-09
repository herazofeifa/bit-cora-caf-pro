import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setCurrentRole, type AppRole } from "@/lib/permissions";
import { hydrateOpsForUser } from "@/lib/store";
import { startCloud, stopCloud } from "@/lib/cloud";

// Session + membership loaded from Lovable Cloud. The role comes from the
// server (memberships table via my_membership()); nothing about privileges is
// read from localStorage. UI checks are convenience only — the database
// enforces every permission again (RLS + role checks in each function).

let session: Session | null = null;
let ready = false;
let activeUser: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function onSignedIn(s: Session) {
  if (activeUser === s.user.id) return;
  activeUser = s.user.id;
  hydrateOpsForUser(s.user.id);
  const { data } = await supabase.rpc("my_membership");
  const m = data?.[0];
  setCurrentRole((m?.role as AppRole | undefined) ?? "consulta");
  if (m) await startCloud(m.organization_id);
}

function onSignedOut() {
  activeUser = null;
  setCurrentRole("consulta");
  stopCloud();
  hydrateOpsForUser(null);
}

let started = false;
export function startAuth() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.getSession().then(async ({ data }) => {
    session = data.session;
    if (session) await onSignedIn(session);
    ready = true;
    emit();
  });
  supabase.auth.onAuthStateChange((event, s) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    session = s;
    if (s) void onSignedIn(s);
    else onSignedOut();
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
  onSignedOut();
}
