import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Anonymous, read-only projections for QR pages. The database functions return NULL for
// both unknown and unpublished tokens, so both become the same 404.
const token = z.object({ token: z.string().regex(/^[a-f0-9]{32}$/) });

function anonClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = (process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"])!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    } },
  });
}

type PublicFile = { id: string; kind: string; title: string; path: string; mime: string; url?: string };

async function signFiles(files: PublicFile[] | undefined) {
  if (!files?.length) return [];
  // Paths come only from the public projection (files explicitly selected, never contracts).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: PublicFile[] = [];
  for (const f of files) {
    const { data } = await supabaseAdmin.storage.from("lot-files").createSignedUrl(f.path, 3600);
    out.push({ id: f.id, kind: f.kind, title: f.title, mime: f.mime, path: "", url: data?.signedUrl });
  }
  return out;
}

const safeInput = (d: unknown) => { const r = token.safeParse(d); if (!r.success) throw notFound(); return r.data; };

export const getPublicLot = createServerFn({ method: "GET" }).inputValidator(safeInput).handler(async ({ data }) => {
  const { data: lot, error } = await anonClient().rpc("public_lot_view", { _token: data.token });
  if (error || !lot) throw notFound();
  const l = lot as Record<string, unknown> & { files?: PublicFile[] };
  return { ...l, files: await signFiles(l.files) } as Record<string, unknown>;
});

export const getPublicSack = createServerFn({ method: "GET" }).inputValidator(safeInput).handler(async ({ data }) => {
  const { data: s, error } = await anonClient().rpc("public_sack_view", { _token: data.token });
  if (error || !s) throw notFound();
  const v = s as { sack: Record<string, unknown>; lot: Record<string, unknown> & { files?: PublicFile[] }; lot_token: string };
  return { sack: v.sack, lot_token: v.lot_token, lot: { ...v.lot, files: await signFiles(v.lot.files) } } as Record<string, unknown>;
});

export const getPublicReport = createServerFn({ method: "GET" }).inputValidator(safeInput).handler(async ({ data }) => {
  const { data: r, error } = await anonClient().rpc("public_report_snapshot", { _token: data.token });
  if (error || !r) throw notFound();
  return r as Record<string, unknown>;
});
