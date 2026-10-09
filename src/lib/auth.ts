import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setCurrentRole, type AppRole } from "@/lib/permissions";
import { hydrateOpsForUser } from "@/lib/store";
import { startCloud, stopCloud } from "@/lib/cloud";
import { clearQueueMemory, loadQueue } from "@/lib/offline-queue";

export interface Membership { organization_id: string; organization_name: string; role: AppRole; is_demo: boolean; eval_kind: "blank" | "sample" | null }
// Evaluation account: every membership is an evaluation space. The chooser shows once per browser session.
const evalChosenKey = (uid: string) => `bcp.eval-chosen:${uid}`;
let evalChosen = false;
export const isEvaluatorAccount = (ms: Membership[]) => ms.length > 0 && ms.every((m) => m.eval_kind);
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
  evalChosen = sessionStorage.getItem(evalChosenKey(s.user.id)) === "1";
  await activate(s.user.id, null);
}

async function activate(uid: string, wanted: string | null) {
  const { data } = await supabase.rpc("my_memberships");
  memberships = (data ?? []) as Membership[];
  const pref = wanted ?? localStorage.getItem(prefKey(uid));
  const m = memberships.find((x) => x.organization_id === pref) ?? memberships[0];
  setCurrentRole((m?.role as AppRole | undefined) ?? "consulta");
  // Device-local legacy cache: evaluation spaces get their own key per organization (no cross-space data).
  hydrateOpsForUser(m?.eval_kind ? `${uid}:${m.organization_id}` : uid);
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
/** Evaluator picks (or re-picks) an environment. Never resets data. */
export async function chooseEvaluationSpace(orgId: string) {
  if (!activeUser) return;
  sessionStorage.setItem(evalChosenKey(activeUser), "1");
  evalChosen = true;
  await activate(activeUser, orgId);
}
export function reopenEvaluationChooser() {
  if (activeUser) sessionStorage.removeItem(evalChosenKey(activeUser));
  evalChosen = false; emit();
}
export function useEvalChosen() {
  return useSyncExternalStore(subscribe, () => evalChosen, () => false);
}
export function useMemberships() {
  return useSyncExternalStore(subscribe, () => memberships, () => memberships);
}

function onSignedOut() {
  if (activeUser) sessionStorage.removeItem(evalChosenKey(activeUser));
  evalChosen = false;
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
