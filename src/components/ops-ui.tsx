import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { commercialStateLabel, physicalStateLabel, qualityStatusLabel } from "@/lib/helpers";

export const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function Section({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={"rounded-2xl border border-border bg-card p-4 md:p-5 shadow-soft " + className}>
      <div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-serif text-lg">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "warn" | "ok" }) {
  return (
    <div className={"rounded-xl border p-3 md:p-4 bg-card " + (tone === "warn" ? "border-destructive/40" : "border-border")}>
      <div className="eyebrow">{label}</div>
      <div className={"text-xl md:text-2xl font-medium mt-1 " + (tone === "warn" ? "text-destructive" : "")}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function LoadState({ loading, error, empty, emptyText }: { loading: boolean; error: string | null; empty?: boolean; emptyText?: string }) {
  if (error) return <p className="text-sm text-destructive py-3">No se pudo cargar: {error}</p>;
  if (loading) return <p className="text-sm text-muted-foreground py-3">Cargando…</p>;
  if (empty) return <p className="text-sm text-muted-foreground py-3">{emptyText ?? "Todavía no hay registros."}</p>;
  return null;
}

export function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground border-b border-border">{head.map((h) => <th key={h} className="py-2 px-1 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border/60 last:border-0">{r.map((c, j) => <td key={j} className="py-2 px-1 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Bars({ data, unit = "kg" }: { data: { key: string; kg: number }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.kg));
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Sin datos.</p>;
  return (
    <ul className="space-y-2">{data.map((d) => (
      <li key={d.key} className="text-sm">
        <div className="flex justify-between"><span>{d.key || "—"}</span><span className="tabular-nums">{d.kg.toLocaleString("es-CR")} {unit}</span></div>
        <div className="h-2 rounded bg-secondary mt-1"><div className="h-2 rounded bg-primary" style={{ width: `${(d.kg / max) * 100}%` }} /></div>
      </li>))}</ul>
  );
}

export const LotLink = ({ id, code }: { id: string; code: string }) => (
  <Link to="/lots/$id" params={{ id }} className="font-mono underline underline-offset-2">{code}</Link>
);

export const stateLabel = (s: string) => (commercialStateLabel as Record<string, string>)[s] ?? s;
export const physLabel = (s: string) => (physicalStateLabel as Record<string, string>)[s] ?? s.replace(/_/g, " ");
export const qualLabel = (s: string) => (qualityStatusLabel as Record<string, string>)[s] ?? s;
export const resLabel: Record<string, string> = { reservada: "Activa", confirmada: "Confirmada", entregada: "Entregada", cancelada: "Cancelada", vencida: "Vencida" };

export type Lot = {
  id: string; lot_code: string; friendly_name: string; variety: string; process_type: string; physical_state: string; commercial_state: string;
  quality_status: string; sale_released: boolean; qty_initial_kg: number; qty_current_kg: number; qty_reserved_kg: number; qty_committed_kg: number;
  qty_blocked_kg: number; qty_sold_kg: number; qty_free_kg: number; current_moisture: number | null; current_location: string | null;
  farm_id: string | null; parcel_id: string | null; parent_lot_id: string | null; harvest_ticket_id: string | null; created_at: string; updated_at: string;
};
