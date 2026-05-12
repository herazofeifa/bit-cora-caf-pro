import { useSyncExternalStore } from "react";

// Conceptual offline-ready sync queue. Not wired to a real backend yet,
// but structured so a future implementation can plug in transparently.

export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface SyncQueueItem {
  id: string;
  entity: string;          // e.g. "lots", "stock_movements"
  action: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  status: SyncStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface QueueState {
  items: SyncQueueItem[];
  online: boolean;
}

const state: QueueState = {
  items: [],
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { state.online = true; emit(); });
  window.addEventListener("offline", () => { state.online = false; emit(); });
}

function uid() {
  return `sq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function enqueueSync(item: Omit<SyncQueueItem, "id" | "status" | "attempts" | "last_error" | "created_at" | "updated_at">) {
  const now = new Date().toISOString();
  state.items.unshift({
    ...item,
    id: uid(),
    status: "pending",
    attempts: 0,
    last_error: null,
    created_at: now,
    updated_at: now,
  });
  emit();
}

export function retrySync(id: string) {
  state.items = state.items.map((i) =>
    i.id === id ? { ...i, status: "pending", last_error: null, updated_at: new Date().toISOString() } : i,
  );
  emit();
}

export function clearSynced() {
  state.items = state.items.filter((i) => i.status !== "synced");
  emit();
}

export function useSyncQueue() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
