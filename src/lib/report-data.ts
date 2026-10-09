// Pure aggregation helpers for the server-backed reports (unit tested).

export interface RLot { id: string; variety: string; process_type: string; farm_id: string | null; commercial_state: string; quality_status: string;
  qty_current_kg: number; qty_free_kg: number; qty_reserved_kg: number; qty_committed_kg: number }
export interface RTicket { farm_id: string; variety: string | null; harvest_date: string; qty_kg: number | null; season: string | null }
export interface RWaste { lot_id: string; waste_type: string; qty_kg: number; registered_at: string }
export interface RRes { lot_id: string; customer_id: string; qty_kg: number; price: number | null; currency: string | null; status: string; delivered_at: string | null }

const n = (v: unknown) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function groupSum<T>(rows: T[], key: (r: T) => string, val: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + val(r));
  return [...m.entries()].map(([k, v]) => ({ key: k, kg: r2(v) })).sort((a, b) => b.kg - a.kg);
}

/** Price weighted by delivered kg, per currency. Rows without price are counted in kg but not in the average. */
export function weightedPriceByCurrency(rows: RRes[]) {
  const m = new Map<string, { kg: number; pricedKg: number; amount: number; n: number }>();
  for (const r of rows) {
    if (r.status !== "entregada") continue;
    const c = r.currency ?? "sin precio";
    const e = m.get(c) ?? { kg: 0, pricedKg: 0, amount: 0, n: 0 };
    e.kg += n(r.qty_kg); e.n += 1;
    if (r.price != null && Number.isFinite(Number(r.price))) { e.pricedKg += n(r.qty_kg); e.amount += n(r.qty_kg) * Number(r.price); }
    m.set(c, e);
  }
  return [...m.entries()].map(([currency, e]) => ({
    currency, deliveries: e.n, kg: r2(e.kg), weighted_price_per_kg: e.pricedKg > 0 ? Math.round((e.amount / e.pricedKg) * 10000) / 10000 : null,
  }));
}
