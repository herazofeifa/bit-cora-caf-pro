import { describe, it, expect } from "vitest";
import { getStoreSnapshot, createReservation } from "../store";
describe("reservas", () => {
  it("no permite reservar más que el inventario libre", () => {
    const lot = getStoreSnapshot().lots.find((l) => l.qty_free_kg > 0)!;
    const customer = getStoreSnapshot().customers[0];
    expect(() => createReservation({ lot_id: lot.id, customer_id: customer.id, qty_kg: lot.qty_free_kg + 1000 } as never)).toThrow();
  });
});
