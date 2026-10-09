import { createStore, get, set } from "idb-keyval";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { currentGeneration, getOrgId } from "@/lib/cloud";
import { registerHarvest, logPhaseVariable } from "@/lib/ops-cloud";

// Durable offline queue (IndexedDB) for field captures only: harvests and phase measurements.
// Partitioned by user + organization. Each item carries its own operation key, so replaying it
// (manual retry, automatic retry, two tabs) is applied once by the server. An item is marked
// "sent" ONLY after the server confirms it. Inventory/reservations/deliveries are never queued.

export type QueueKind = "harvest" | "measurement";
export interface QueueItem {
  opKey: string;
  kind: QueueKind;
  /** organization captured when the item was queued; it is always sent to this org */
  org?: string;
  label: string;
  payload: Record<string, unknown>;
  status: "pending" | "sending" | "rejected" | "sent";
  error?: string;
  attempts: number;
  createdAt: string;
  result?: string;
}

const db = typeof indexedDB !== "undefined" ? createStore("bcp-offline", "queue") : null;
let items: QueueItem[] = [];
let partition: string | null = null;
let partitionOrg: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const getQueueSnapshot = () => items;
export const useQueue = () =>
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => items, () => items);

async function currentPartition() {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id; const org = getOrgId();
  return uid && org ? `q:${uid}:${org}` : null;
}
async function persist() { if (db && partition) await set(partition, items, db); emit(); }

export async function loadQueue() {
  const gen = currentGeneration();
  const p = await currentPartition();
  if (gen !== currentGeneration()) return; // session/org changed while reading the session
  partition = p; partitionOrg = getOrgId();
  const stored = db && p ? ((await get<QueueItem[]>(p, db)) ?? []) : [];
  if (partition !== p) return;
  items = stored;
  // an item interrupted mid-send goes back to pending (the op key makes the retry safe)
  items = items.map((i) => (i.status === "sending" ? { ...i, status: "pending" } : i));
  emit();
}
export function clearQueueMemory() { items = []; partition = null; partitionOrg = null; emit(); }

export async function enqueue(kind: QueueKind, label: string, payload: Record<string, unknown>, opKey: string) {
  if (!partition) await loadQueue();
  if (!partition) throw new Error("Inicia sesión para guardar borradores.");
  if (items.some((i) => i.opKey === opKey)) return;
  items = [...items, { opKey, kind, org: partitionOrg ?? undefined, label, payload, status: "pending", attempts: 0, createdAt: new Date().toISOString() }];
  await persist();
}

const isNetworkError = (e: unknown) => /conexión|Failed to fetch|NetworkError|network/i.test(String((e as Error)?.message ?? e));

type Sender = (i: QueueItem, org: string) => Promise<string>;
let sender: Sender = async (i, org) => {
  if (i.kind === "harvest") {
    const p = i.payload as { data: Record<string, unknown>; targetLot: string | null; lotName: string | null };
    const r = await registerHarvest(p.data, p.targetLot, p.lotName, i.opKey, org);
    return `Lote ${r.lot_code} (+${r.qty_kg} kg)`;
  }
  const p = i.payload as { phase: string; key: string; value: number; unit: string | null };
  await logPhaseVariable(p.phase, p.key, p.value, p.unit, i.opKey);
  return "Medición guardada";
};
/** test hook */
export function __setSender(s: Sender) { sender = s; }

let flushingPartition: string | null = null;
/**
 * Sends pending items of the CURRENT partition. User, organization, partition and generation are captured
 * when the flush starts; if any of them changes (logout, org switch) the flush stops, and late replies are
 * discarded instead of being written into another partition's list.
 */
export async function flushQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const myPartition = partition, myOrg = partitionOrg, myGen = currentGeneration();
  if (!myPartition || !myOrg || flushingPartition === myPartition) return;
  flushingPartition = myPartition;
  const stale = () => partition !== myPartition || currentGeneration() !== myGen;
  try {
    for (const it of items.filter((x) => x.status === "pending")) {
      if (stale()) return;
      items = items.map((x) => (x.opKey === it.opKey ? { ...x, status: "sending", attempts: x.attempts + 1 } : x)); await persist();
      let result: string | undefined; let err: unknown = null;
      try { result = await sender(it, it.org ?? myOrg); } catch (e) { err = e; }
      if (stale()) return; // reply from an old partition: drop it (op key makes the later retry safe)
      if (err === null) items = items.map((x) => (x.opKey === it.opKey ? { ...x, status: "sent", result, error: undefined } : x));
      else {
        const net = isNetworkError(err);
        items = items.map((x) => (x.opKey === it.opKey ? { ...x, status: net ? "pending" : "rejected", error: (err as Error).message } : x));
        await persist();
        if (net) break;
      }
      await persist();
    }
  } finally { if (flushingPartition === myPartition) flushingPartition = null; }
}
export async function retryItem(opKey: string) {
  items = items.map((x) => (x.opKey === opKey ? { ...x, status: "pending", error: undefined } : x)); await persist(); await flushQueue();
}
export async function discardItem(opKey: string) { items = items.filter((x) => x.opKey !== opKey); await persist(); }
export async function clearSent() { items = items.filter((x) => x.status !== "sent"); await persist(); }

let auto = false;
export function startAutoFlush() {
  if (auto || typeof window === "undefined") return; auto = true;
  window.addEventListener("online", () => void flushQueue());
  setInterval(() => void flushQueue(), 30000);
}
