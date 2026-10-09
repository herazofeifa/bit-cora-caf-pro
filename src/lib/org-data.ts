import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { currentGeneration, useCloudState } from "@/lib/cloud";
import { friendlyError } from "@/lib/ops-cloud";

// One read path for every screen: data of the selected organization only.
// - The fetcher receives the org id; a reply is applied only if org + generation are unchanged
//   (logout / org switch can never repopulate previous data).
// - Listed tables are watched with realtime filtered by organization, so other sessions'
//   changes (catalogs, measurements, lots, reservations…) refresh the screen.
export function useOrgQuery<T>(key: string, fetcher: (org: string) => Promise<T>, tables: string[], initial: T) {
  const { orgId } = useCloudState();
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetcher); fetchRef.current = fetcher;
  const tablesKey = tables.join(",");

  const load = useCallback(async () => {
    if (!orgId) return;
    const gen = currentGeneration();
    try {
      const d = await fetchRef.current(orgId);
      if (gen !== currentGeneration()) return;
      setData(d); setError(null);
    } catch (e) {
      if (gen === currentGeneration()) setError(friendlyError(e));
    } finally {
      if (gen === currentGeneration()) setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    setData(initial); setLoading(true); setError(null);
    if (!orgId) return;
    void load();
    let t: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase.channel(`q-${key}-${orgId}-${Math.random().toString(36).slice(2)}`);
    for (const table of tablesKey.split(",").filter(Boolean)) {
      ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `organization_id=eq.${orgId}` }, () => {
        if (t) clearTimeout(t); t = setTimeout(() => void load(), 250);
      });
    }
    ch.subscribe();
    return () => { if (t) clearTimeout(t); void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, key, tablesKey, load]);

  return { data, loading, error, reload: load, orgId };
}

async function q<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(friendlyError(error));
  return (data ?? []) as T;
}
export const sel = <T,>(table: string, cols: string, org: string, order = "created_at", asc = false, limit = 1000) =>
  q<T>((supabase.from(table as never) as unknown as { select: (c: string) => { eq: (a: string, b: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> } } } })
    .select(cols).eq("organization_id", org).order(order, { ascending: asc }).limit(limit));

export type OrgSettings = { low_stock_kg?: number; moisture_min?: number; moisture_max?: number; moisture_ideal?: number; default_sack_kg?: number; public_show_producer?: boolean };
export const DEFAULT_ORG_SETTINGS: Required<OrgSettings> = { low_stock_kg: 100, moisture_min: 10, moisture_max: 12, moisture_ideal: 11, default_sack_kg: 46, public_show_producer: true };
export async function loadOrgSettings(org: string): Promise<Required<OrgSettings>> {
  const { data, error } = await supabase.from("org_settings").select("settings").eq("organization_id", org).maybeSingle();
  if (error) throw new Error(friendlyError(error));
  return { ...DEFAULT_ORG_SETTINGS, ...((data?.settings ?? {}) as OrgSettings) };
}
export async function saveOrgSettings(org: string, s: OrgSettings) {
  const { error } = await supabase.from("org_settings").upsert({ organization_id: org, settings: s as never, updated_at: new Date().toISOString() });
  if (error) throw new Error(friendlyError(error));
}

export const fmtKg = (n: number | null | undefined) => `${Number(n ?? 0).toLocaleString("es-CR", { maximumFractionDigits: 1 })} kg`;
export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const fmtDay = (s: string | null | undefined) => (s ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("es-CR") : "—");
