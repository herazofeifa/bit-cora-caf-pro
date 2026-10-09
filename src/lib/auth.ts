import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setCurrentRole, type AppRole } from "@/lib/permissions";
import { hydrateOpsForUser } from "@/lib/store";
import { startCloud, stopCloud } from "@/lib/cloud";
import { clearQueueMemory, loadQueue } from "@/lib/offline-queue";

export interface Membership { organization_id: string; organization_name: string; role: AppRole; is_demo: boolean }
let memberships: Membership[] = [];
// Only remembers WHICH organization to view; access is still decided by the database per request.
const prefKey = (uid: string) => `bcp.active-org:${uid}`;

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
  await activate(s.user.id, null);
}

async function activate(uid: string, wanted: string | null) {
  const { data } = await supabase.rpc("my_memberships");
  memberships = (data ?? []) as Membership[];
  const pref = wanted ?? localStorage.getItem(prefKey(uid));
  const m = memberships.find((x) => x.organization_id === pref) ?? memberships[0];
  setCurrentRole((m?.role as AppRole | undefined) ?? "consulta");
  emit();
  if (m) {
    localStorage.setItem(prefKey(uid), m.organization_id);
    await startCloud(m.organization_id);
    await loadQueue();
  }
}

export async function switchOrganization(orgId: string) {
  if (!activeUser) return;
  await activate(activeUser, orgId);
}
export function useMemberships() {
  return useSyncExternalStore(subscribe, () => memberships, () => memberships);
}

function onSignedOut() {
  activeUser = null;
  memberships = [];
  clearQueueMemory();
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
