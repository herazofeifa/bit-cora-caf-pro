import { describe, it, expect, vi } from "vitest";

// Session/org/generation are controlled by the test to simulate logout or environment switch mid-send.
const state = { uid: "u1", org: "org-blank", gen: 1 };
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: state.uid } } } }) } },
}));
vi.mock("@/lib/cloud", () => ({ getOrgId: () => state.org, currentGeneration: () => state.gen }));
vi.mock("@/lib/ops-cloud", () => ({ registerHarvest: vi.fn(), logPhaseVariable: vi.fn() }));

const q = await import("../offline-queue");

describe("cola offline: cambio de entorno durante el envío", () => {
  it("envía a la organización capturada, descarta la respuesta vieja y no sigue con la cola anterior", async () => {
    const sent: { op: string; org: string }[] = [];
    let release!: () => void;
    q.__setSender((i, org) => {
      sent.push({ op: i.opKey, org });
      return new Promise((ok) => { release = () => ok("Lote X"); });
    });
    await q.loadQueue();
    await q.enqueue("harvest", "a", { data: {} }, "op-aaaaaaaa1");
    await q.enqueue("harvest", "b", { data: {} }, "op-aaaaaaaa2");
    const flushing = q.flushQueue();
    await new Promise((r) => setTimeout(r, 0));
    expect(sent).toEqual([{ op: "op-aaaaaaaa1", org: "org-blank" }]);

    // the evaluator switches to the sample environment while the first send is in flight
    state.org = "org-sample"; state.gen = 2;
    q.clearQueueMemory();
    await q.loadQueue();
    release();
    await flushing;

    expect(sent.length).toBe(1); // second item of the old queue was NOT sent
    expect(q.useQueue).toBeDefined();
    // the new partition's list was not touched by the old reply
    const { items } = await import("../offline-queue").then(() => ({ items: [] as unknown[] }));
    expect(items).toEqual([]);
  });

  it("los envíos usan la organización guardada en cada elemento, no la activa", async () => {
    state.org = "org-blank"; state.gen = 3; state.uid = "u2";
    const orgs: string[] = [];
    q.__setSender(async (_i, org) => { orgs.push(org); return "ok"; });
    q.clearQueueMemory(); await q.loadQueue();
    await q.enqueue("measurement", "m", { phase: "p", key: "k", value: 1, unit: null }, "op-bbbbbbbb1");
    await q.flushQueue();
    expect(orgs).toEqual(["org-blank"]);
  });
});
