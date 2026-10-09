import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Copilot: free conversation in Spanish using the OpenAI API directly from the server
// (secret OPENAI_API_KEY, never sent to the browser). The model can only call the read-only
// tools below; each one runs with the signed-in user's database session, so RLS limits it to
// organizations where the user is an active member. No SQL, no writes.

const input = z.object({
  organizationId: z.string().uuid(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(30),
});

type Sb = { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const obj = (props: Record<string, unknown>) => ({ type: "object", properties: props, required: Object.keys(props), additionalProperties: false });
const TOOLS = [
  { type: "function", name: "inventario_libre", strict: true, description: "Café libre para vender (kg) y en proceso, agrupado por variedad o proceso.",
    parameters: obj({ agrupar_por: { type: "string", enum: ["variedad", "proceso", "estado_fisico"] } }) },
  { type: "function", name: "procesos_atrasados", strict: true, description: "Fases en curso que superan la duración esperada o fermentan más de 20 días.", parameters: obj({}) },
  { type: "function", name: "reservas_activas", strict: true, description: "Reservas reservadas o confirmadas, con cliente, kg, precio por kg y vencimiento.", parameters: obj({}) },
  { type: "function", name: "mermas", strict: true, description: "Mermas registradas por tipo y por temporada de cosecha, en un rango de fechas (YYYY-MM-DD).",
    parameters: obj({ desde: { type: "string" }, hasta: { type: "string" } }) },
  { type: "function", name: "ventas_entregadas", strict: true, description: "Kg entregados y precio promedio ponderado por kg, por moneda, en un rango de fechas (YYYY-MM-DD, hasta exclusivo).",
    parameters: obj({ desde: { type: "string" }, hasta: { type: "string" } }) },
  { type: "function", name: "resumen_comprador", strict: true, description: "Historial de reservas y entregas de un cliente por nombre (búsqueda parcial).",
    parameters: obj({ nombre: { type: "string" } }) },
  { type: "function", name: "sacos_disponibles", strict: true, description: "Café libre en kg y su equivalencia en sacos usando el peso de saco CONFIGURADO por la organización, más los sacos físicos etiquetados. Filtra por variedad (vacío = todas).",
    parameters: obj({ variedad: { type: "string" } }) },
  { type: "function", name: "buscar_lote", strict: true, description: "Datos de un lote por código (ej. LAV-2026-001): kg, estados, fases y última humedad.",
    parameters: obj({ codigo: { type: "string" } }) },
];

const MAX_INPUT_CHARS = 12000;
const MAX_OUTPUT_TOKENS = 900;
const GLOBAL_MS = 40000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
async function runTool(sb: Sb, org: string, name: string, args: Record<string, string>) {
  switch (name) {
    case "inventario_libre": {
      const { data, error } = await sb.from("lots").select("variety,process_type,physical_state,qty_current_kg,qty_free_kg,qty_reserved_kg,qty_committed_kg,commercial_state").eq("organization_id", org);
      if (error) throw error;
      const key = args.agrupar_por === "proceso" ? "process_type" : args.agrupar_por === "estado_fisico" ? "physical_state" : "variety";
      const g: Record<string, { libre_kg: number; actual_kg: number; reservado_kg: number; comprometido_kg: number; en_proceso_kg: number; lotes: number }> = {};
      for (const l of data ?? []) {
        const k = l[key] || "(sin dato)"; const e = (g[k] ??= { libre_kg: 0, actual_kg: 0, reservado_kg: 0, comprometido_kg: 0, en_proceso_kg: 0, lotes: 0 });
        e.libre_kg += +l.qty_free_kg; e.actual_kg += +l.qty_current_kg; e.reservado_kg += +l.qty_reserved_kg; e.comprometido_kg += +l.qty_committed_kg; e.lotes++;
        if (l.commercial_state === "en_proceso") e.en_proceso_kg += +l.qty_current_kg;
      }
      return { unidad: "kg", grupos: g, total_lotes: data?.length ?? 0 };
    }
    case "procesos_atrasados": { const { data, error } = await sb.rpc("overdue_phases", { _org: org }); if (error) throw error; return { filas: data ?? [] }; }
    case "reservas_activas": {
      const { data, error } = await sb.from("reservations").select("qty_kg,price,currency,price_unit,status,expires_at,customers(name),lots(lot_code)").eq("organization_id", org).in("status", ["reservada", "confirmada"]);
      if (error) throw error; return { filas: data ?? [] };
    }
    case "mermas": {
      if (!DATE.test(args.desde) || !DATE.test(args.hasta)) return { error: "fechas inválidas" };
      const { data, error } = await sb.from("waste_logs").select("waste_type,qty_kg,registered_at,lots(lot_code,harvest_tickets!lots_harvest_ticket_id_fkey(season))").eq("organization_id", org).gte("registered_at", args.desde).lte("registered_at", args.hasta + "T23:59:59");
      if (error) throw error;
      const porTipo: Record<string, number> = {}; const porTemporada: Record<string, number> = {};
      for (const w of data ?? []) {
        porTipo[w.waste_type] = (porTipo[w.waste_type] ?? 0) + +w.qty_kg;
        const s = w.lots?.harvest_tickets?.season ?? "(sin temporada)"; porTemporada[s] = (porTemporada[s] ?? 0) + +w.qty_kg;
      }
      return { unidad: "kg", registros: data?.length ?? 0, por_tipo: porTipo, por_temporada: porTemporada };
    }
    case "ventas_entregadas": {
      if (!DATE.test(args.desde) || !DATE.test(args.hasta)) return { error: "fechas inválidas" };
      const { data, error } = await sb.rpc("sales_summary", { _org: org, _from: args.desde, _to: args.hasta }); if (error) throw error;
      return { nota: "precio ponderado por kg entregado; solo entregas con precio cuentan para el promedio", filas: data ?? [] };
    }
    case "resumen_comprador": {
      const n = String(args.nombre ?? "").slice(0, 80).replace(/[%_,()]/g, " ").trim();
      const { data: cs, error } = await sb.from("customers").select("id,name,type,country").eq("organization_id", org).ilike("name", `%${n}%`).limit(3);
      if (error) throw error;
      if (!cs?.length) return { encontrado: false };
      const out = [];
      for (const c of cs) {
        const { data: r } = await sb.from("reservations").select("qty_kg,price,currency,status,reserved_at,delivered_at,lots(lot_code,variety,process_type)").eq("customer_id", c.id).order("reserved_at", { ascending: false }).limit(50);
        out.push({ cliente: c, reservas: r ?? [] });
      }
      return { encontrado: true, clientes: out };
    }
    case "sacos_disponibles": {
      const v = String(args.variedad ?? "").slice(0, 60).replace(/[%_,()]/g, " ").trim();
      let qy = sb.from("lots").select("id,lot_code,variety,qty_free_kg,commercial_state").eq("organization_id", org).gt("qty_free_kg", 0);
      if (v) qy = qy.ilike("variety", `%${v}%`);
      const [{ data: lots, error }, { data: st }] = await Promise.all([qy, sb.from("org_settings").select("settings").eq("organization_id", org).maybeSingle()]);
      if (error) throw error;
      const raw = Number((st?.settings as { default_sack_kg?: unknown } | null)?.default_sack_kg);
      const sackKg = Number.isFinite(raw) && raw > 0 ? raw : null; // never assume a default weight
      const ids = (lots ?? []).map((l: { id: string }) => l.id);
      const { data: sacks } = ids.length ? await sb.from("sacks").select("lot_id,weight_kg").in("lot_id", ids) : { data: [] };
      const libre = (lots ?? []).reduce((a: number, l: { qty_free_kg: number }) => a + +l.qty_free_kg, 0);
      return {
        variedad: v || "(todas)", libre_kg: libre, lotes: (lots ?? []).map((l: { lot_code: string; variety: string; qty_free_kg: number }) => ({ lote: l.lot_code, variedad: l.variety, libre_kg: +l.qty_free_kg })),
        peso_saco_configurado_kg: sackKg,
        equivalencia_sacos: sackKg ? Math.floor((libre / sackKg) * 100) / 100 : null,
        sacos_fisicos_etiquetados: (sacks ?? []).length,
        nota: sackKg ? "equivalencia_sacos es kg libres ÷ peso de saco configurado; NO es un conteo físico. sacos_fisicos_etiquetados son etiquetas QR creadas (pueden incluir café reservado)."
          : "La organización no ha configurado el peso por saco en Ajustes; solo se puede informar en kg y las etiquetas físicas.",
      };
    }
    case "buscar_lote": {
      const { data: l, error } = await sb.from("lots").select("id,lot_code,friendly_name,variety,process_type,physical_state,commercial_state,quality_status,qty_current_kg,qty_free_kg,qty_reserved_kg,qty_committed_kg,qty_sold_kg,current_moisture").eq("organization_id", org).ilike("lot_code", String(args.codigo).slice(0, 40)).maybeSingle();
      if (error) throw error; if (!l) return { encontrado: false };
      const { data: ph } = await sb.from("process_phases").select("name,status,started_at,ended_at,weight_in_kg,weight_out_kg").eq("lot_id", l.id).order("started_at");
      return { encontrado: true, lote: l, fases: ph ?? [] };
    }
  }
  return { error: "herramienta no permitida" };
}

const SYSTEM = (today: string, orgName: string) => `Eres el copiloto de Bitácora Café Pro para el microbeneficio "${orgName}". Hoy es ${today}.
Responde en español claro y breve, para productores. Usa SOLO datos obtenidos con las herramientas; si no hay registros, dilo ("no hay registros de…") y no inventes cifras.
Indica siempre unidades (kg) y moneda. Para "mes pasado" o "este año" calcula las fechas tú mismo. Si sugieres algo, explica en qué dato te basas.
Si preguntan por sacos, distingue SIEMPRE la equivalencia (kg ÷ peso configurado) de los sacos físicos etiquetados; si no hay peso configurado, dilo y responde en kg.
No puedes modificar datos: si te piden registrar o cambiar algo, indica la pantalla de la app donde hacerlo.`;

export const askCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "El copiloto no está configurado: falta la clave de OpenAI (OPENAI_API_KEY) en los secretos del proyecto." };
    const sb = context.supabase as unknown as Sb;
    const totalChars = data.messages.reduce((a, x) => a + x.content.length, 0);
    if (totalChars > MAX_INPUT_CHARS) return { ok: false as const, error: `La conversación es demasiado larga (${totalChars} caracteres; máximo ${MAX_INPUT_CHARS}). Empieza una nueva.` };
    const { data: quota, error: qErr } = await sb.rpc("copilot_take_quota", { _org: data.organizationId });
    if (qErr) return { ok: false as const, error: "No perteneces a esa organización." };
    if (!quota?.ok) return { ok: false as const, error: `Alcanzaste el límite de preguntas al copiloto (${quota?.limit_hour} por hora, ${quota?.limit_day} por día). Intenta más tarde.` };
    const { data: ms } = await sb.rpc("my_memberships", {});
    const m = (ms ?? []).find((x: { organization_id: string }) => x.organization_id === data.organizationId);
    if (!m) return { ok: false as const, error: "No perteneces a esa organización." };

    // Some OpenAI projects only enable certain models: fall back in order when one is not available.
    const models = [process.env["OPENAI_MODEL"], "gpt-4.1-mini", "gpt-4o-mini", "gpt-5-mini", "gpt-4.1", "gpt-4o"].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
    let model = models.shift()!;
    const today = new Date().toISOString().slice(0, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = data.messages.map((x) => ({ role: x.role, content: x.content }));
    const used: string[] = [];
    const started = Date.now();
    const deadline = AbortSignal.timeout(GLOBAL_MS); // one budget for every round, including tool calls
    for (let step = 0; step < 6; step++) {
      if (deadline.aborted) return { ok: false as const, error: "La consulta tardó demasiado. Intenta una pregunta más concreta." };
      let resp: Response;
      try {
        resp = await fetch("https://api.openai.com/v1/responses", {
          method: "POST", signal: deadline,
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, instructions: SYSTEM(today, m.organization_name), input: items, tools: TOOLS, store: false, max_output_tokens: MAX_OUTPUT_TOKENS }),
        });
      } catch (e) {
        const timeout = (e as Error)?.name === "TimeoutError" || deadline.aborted;
        return { ok: false as const, error: timeout ? "OpenAI tardó demasiado en responder. Intenta de nuevo." : "No se pudo conectar con OpenAI." };
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        if ((resp.status === 403 || resp.status === 404) && /model_not_found|does not have access to model/.test(body) && models.length) {
          model = models.shift()!; step--; continue;
        }
        const msg = /model_not_found|does not have access to model/.test(body) ? "La cuenta de OpenAI no tiene acceso a ningún modelo compatible. Habilita gpt-4.1-mini o gpt-4o-mini en el proyecto de OpenAI." : null;
        const msg2 = resp.status === 401 ? "La clave de OpenAI no es válida."
          : resp.status === 429 ? "OpenAI limitó las solicitudes o la cuenta no tiene saldo. Espera un momento o revisa la cuenta de OpenAI."
          : resp.status >= 500 ? "OpenAI tiene un problema temporal. Intenta más tarde."
          : `OpenAI rechazó la solicitud (${resp.status}).`;
        // log only status + OpenAI error code; never the prompt, the answer or the key
        console.error("copilot openai", resp.status, (body.match(/"code":\s*"([^"]+)"/) ?? [])[1] ?? "");
        return { ok: false as const, error: msg ?? msg2 };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await resp.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calls = (json.output ?? []).filter((o: any) => o.type === "function_call");
      if (calls.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = (json.output ?? []).filter((o: any) => o.type === "message").flatMap((o: any) => o.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("\n").trim();
        return { ok: true as const, text: text || "No obtuve respuesta.", tools: used, ms: Date.now() - started, model };
      }
      items.push(...json.output.filter((o: { type: string }) => o.type === "function_call"));
      for (const c of calls) {
        let out: unknown;
        try {
          if (!TOOLS.some((t) => t.name === c.name)) out = { error: "herramienta no permitida" };
          else { out = await runTool(sb, data.organizationId, c.name, JSON.parse(c.arguments || "{}")); used.push(c.name); }
        } catch (e) { out = { error: (e as Error).message ?? "error al consultar" }; }
        items.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify(out).slice(0, 20000) });
      }
    }
    return { ok: false as const, error: "La consulta requirió demasiados pasos. Intenta una pregunta más concreta." };
  });
