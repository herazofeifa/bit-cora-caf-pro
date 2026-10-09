import { describe, it, expect } from "vitest";
import { getStoreSnapshot, hydrateOpsForUser, loadDemoData, setCustomersFromCloud } from "../store";

describe("aislamiento de caché local", () => {
  it("arranca vacío: el demo solo se carga explícitamente", () => {
    hydrateOpsForUser(null);
    expect(getStoreSnapshot().lots).toHaveLength(0);
    loadDemoData();
    expect(getStoreSnapshot().lots.length).toBeGreaterThan(0);
  });
  it("al cerrar sesión no quedan lotes ni clientes en memoria", () => {
    loadDemoData();
    setCustomersFromCloud([{ id: "c1" } as never]);
    hydrateOpsForUser(null);
    expect(getStoreSnapshot().lots).toHaveLength(0);
    expect(getStoreSnapshot().customers).toHaveLength(0);
  });
});
