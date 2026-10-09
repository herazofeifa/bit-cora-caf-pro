import { createStore, get, set } from "idb-keyval";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/cloud";
import { registerHarvest, logPhaseVariable } from "@/lib/ops-cloud";

// Durable offline queue (IndexedDB) for field captures only: harvests and phase measurements.
// Partitioned by user + organization. Each item carries its own operation key, so replaying it
// (manual retry, automatic retry, two tabs) is applied once by the server. An item is marked
// "sent" ONLY after the server confirms it. Inventory/reservations/deliveries are never queued.

export type QueueKind = "harvest" | "measurement";
export interface QueueItem {
  opKey: string;
  kind: QueueKind;
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
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const useQueue = () =>
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => items, () => items);

async function currentPartition() {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id; const org = getOrgId();
  return uid && org ? `q:${uid}:${org}` : null;
}
async function persist() { if (db && partition) await set(partition, items, db); emit(); }

export async function loadQueue() {
  partition = await currentPartition();
  items = db && partition ? ((await get<QueueItem[]>(partition, db)) ?? []) : [];
  // an item interrupted mid-send goes back to pending (the op key makes the retry safe)
  items = items.map((i) => (i.status === "sending" ? { ...i, status: "pending" } : i));
  emit();
}
export function clearQueueMemory() { items = []; partition = null; emit(); }

export async function enqueue(kind: QueueKind, label: string, payload: Record<string, unknown>, opKey: string) {
  if (!partition) await loadQueue();
  if (!partition) throw new Error("Inicia sesión para guardar borradores.");
  if (items.some((i) => i.opKey === opKey)) return;
  items = [...items, { opKey, kind, label, payload, status: "pending", attempts: 0, createdAt: new Date().toISOString() }];
  await persist();
}

const isNetworkError = (e: unknown) => /conexión|Failed to fetch|NetworkError|network/i.test(String((e as Error)?.message ?? e));

async function send(i: QueueItem) {
  if (i.kind === "harvest") {
    const p = i.payload as { data: Record<string, unknown>; targetLot: string | null; lotName: string | null };
    const r = await registerHarvest(p.data, p.targetLot, p.lotName, i.opKey);
    return `Lote ${r.lot_code} (+${r.qty_kg} kg)`;
  }
  const p = i.payload as { phase: string; key: string; value: number; unit: string | null };
  await logPhaseVariable(p.phase, p.key, p.value, p.unit, i.opKey);
  return "Medición guardada";
}

let flushing = false;
export async function flushQueue() {
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  flushing = true;
  try {
    for (const it of items.filter((x) => x.status === "pending")) {
      items = items.map((x) => (x.opKey === it.opKey ? { ...x, status: "sending", attempts: x.attempts + 1 } : x)); await persist();
      try {
        const result = await send(it);
        items = items.map((x) => (x.opKey === it.opKey ? { ...x, status: "sent", result, error: undefined } : x));
      } catch (e) {
        const net = isNetworkError(e);
        items = items.map((x) => (x.opKey === it.opKey ? { ...x, status: net ? "pending" : "rejected", error: (e as Error).message } : x));
        await persist();
        if (net) break;
      }
      await persist();
    }
  } finally { flushing = false; }
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
