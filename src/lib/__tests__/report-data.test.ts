import { describe, expect, it } from "vitest";
import { weightedPriceByCurrency, groupSum } from "@/lib/report-data";

describe("weighted price per delivered kg", () => {
  it("weights by kilos, per currency, and ignores undelivered", () => {
    const rows = [
      { lot_id: "a", customer_id: "c", qty_kg: 60, price: 6, currency: "USD", status: "entregada", delivered_at: "x" },
      { lot_id: "a", customer_id: "c", qty_kg: 40, price: 8, currency: "USD", status: "entregada", delivered_at: "x" },
      { lot_id: "a", customer_id: "c", qty_kg: 500, price: 1, currency: "USD", status: "reservada", delivered_at: null },
      { lot_id: "a", customer_id: "c", qty_kg: 10, price: 3000, currency: "CRC", status: "entregada", delivered_at: "x" },
    ];
    const r = weightedPriceByCurrency(rows);
    expect(r.find((x) => x.currency === "USD")).toMatchObject({ kg: 100, weighted_price_per_kg: 6.8 });
    expect(r.find((x) => x.currency === "CRC")).toMatchObject({ kg: 10, weighted_price_per_kg: 3000 });
  });
  it("groups kilos", () => {
    expect(groupSum([{ v: "Geisha", k: 2 }, { v: "Geisha", k: 3 }, { v: "Caturra", k: 1 }], (r) => r.v, (r) => r.k)[0]).toEqual({ key: "Geisha", kg: 5 });
  });
});
