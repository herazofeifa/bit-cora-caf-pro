import { describe, it, expect, vi, beforeEach } from "vitest";

// Controllable fake backend: every query resolves only when the test says so.
const pending: { table: string; resolve: (v: unknown) => void }[] = [];
const inserts: { table: string; row: Record<string, unknown> }[] = [];
function query(table: string) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  Object.assign(q, {
    select: chain, eq: chain, order: () => new Promise((resolve) => pending.push({ table, resolve })),
    insert: (row: Record<string, unknown>) => { inserts.push({ table, row }); return Promise.resolve({ error: null }); },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
  });
  return q;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => query(t),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => Promise.resolve(),
  },
}));

const { startCloud, stopCloud, cloudSaveFarms, cloudSaveParcels } = await import("../cloud");
const { getStoreSnapshot } = await import("../store");
const { getAppConfigSnapshot } = await import("../app-config-store");

const flush = () => new Promise((r) => setTimeout(r, 0));
const answerAll = (rows: Record<string, unknown[]>) => {
  for (const p of pending.splice(0)) p.resolve({ data: rows[p.table] ?? [], error: null });
};

beforeEach(() => { stopCloud(); pending.length = 0; inserts.length = 0; });

describe("capa de datos compartidos: respuestas viejas", () => {
  it("una respuesta que llega después del cierre de sesión se descarta", async () => {
    const run = startCloud("org-a");
    await flush();
    stopCloud(); // logout while requests are in flight
    answerAll({ customers: [{ id: "c-a", name: "De A" }], farms: [{ id: "f-a" }], parcels: [] });
    await run;
    expect(getStoreSnapshot().customers).toHaveLength(0);
    expect(getAppConfigSnapshot().farms).toHaveLength(0);
  });

  it("al cambiar de organización solo quedan los datos de la nueva", async () => {
    const runA = startCloud("org-a");
    await flush();
    const oldReplies = pending.splice(0);
    const runB = startCloud("org-b");
    await flush();
    answerAll({ customers: [{ id: "c-b", name: "De B" }], farms: [], parcels: [] });
    await runB;
    for (const p of oldReplies) p.resolve({ data: p.table === "customers" ? [{ id: "c-a", name: "De A" }] : [], error: null });
    await runA;
    expect(getStoreSnapshot().customers.map((c) => c.id)).toEqual(["c-b"]);
  });
});

describe("guardar fincas y parcelas nuevas", () => {
  it("una parcela de una finca nueva con id temporal queda ligada al id confirmado", async () => {
    const run = startCloud("org-a");
    await flush(); answerAll({}); await run;
    const save = cloudSaveFarms([{ id: "farm-temp-1", name: "Nueva" } as never]);
    await flush(); answerAll({});
    const map = await save;
    const farmId = map.get("farm-temp-1")!;
    expect(farmId).toMatch(/^[0-9a-f-]{36}$/);
    expect(inserts.find((i) => i.table === "farms")?.row.id).toBe(farmId);
    const saveP = cloudSaveParcels([{ id: "parcel-temp-1", farm_id: "farm-temp-1", name: "P1" } as never], [], map);
    await flush(); answerAll({});
    await saveP;
    expect(inserts.find((i) => i.table === "parcels")?.row.farm_id).toBe(farmId);
  });
});
