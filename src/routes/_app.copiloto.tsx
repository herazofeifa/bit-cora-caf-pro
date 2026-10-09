import { createFileRoute, Link } from "@tanstack/react-router";
const GUIDED = [{ to: "/harvest", l: "Registrar cosecha" }, { to: "/variables", l: "Registrar humedad" }, { to: "/waste", l: "Registrar merma" }, { to: "/reservations", l: "Reservar café" }] as const;
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Send } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCloudState } from "@/lib/cloud";
import { sel, useOrgQuery } from "@/lib/org-data";
import { askCopilot } from "@/lib/copilot.functions";

export const Route = createFileRoute("/_app/copiloto")({
  head: () => ({ meta: [
    { title: "Copiloto — Bitácora Café Pro" },
    { name: "description", content: "Pregunta en español sobre inventario, procesos, reservas, mermas y ventas con datos reales." },
  ] }),
  component: CopilotPage,
});

type Msg = { role: "user" | "assistant"; content: string; meta?: string; error?: boolean };
const EXAMPLES = ["¿Cuánto café libre tengo por variedad?", "¿Cuántos sacos de Geisha hay disponibles?", "¿Qué procesos están atrasados?", "¿Cuántos kg entregué el mes pasado?",
  "¿Cuál es mi precio promedio ponderado este año?"];

// Minimal typing for the browser speech API (not available in every browser).
type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };

function CopilotPage() {
  const cloud = useCloudState(); const ask = useServerFn(askCopilot);
  const [msgs, setMsgs] = useState<Msg[]>([]); const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  // Buyer example uses a real customer of the selected organization (never a mock name).
  const firstCustomer = useOrgQuery<{ name: string }[]>("cp-cust", (o) => sel("customers", "name", o, "name", true, 1), ["customers"], []);
  const buyer = firstCustomer.data[0]?.name;
  const [listening, setListening] = useState(false); const [voice, setVoice] = useState(false);
  const rec = useRef<SR | null>(null); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }; setVoice(!!(w.SpeechRecognition || w.webkitSpeechRecognition)); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send(q: string) {
    if (!q.trim() || !cloud.orgId || busy) return;
    const next = [...msgs, { role: "user" as const, content: q.trim() }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r = await ask({ data: { organizationId: cloud.orgId, messages: next.filter((m) => !m.error).slice(-20).map(({ role, content }) => ({ role, content })) } });
      setMsgs([...next, r.ok ? { role: "assistant", content: r.text, meta: `${r.tools.length ? `Consultó: ${r.tools.join(", ")}` : "Sin consultas"} · ${(r.ms / 1000).toFixed(1)} s` }
        : { role: "assistant", content: r.error, error: true }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: (e as Error).message || "Error inesperado", error: true }]);
    } finally { setBusy(false); }
  }
  function toggleVoice() {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const C = w.SpeechRecognition ?? w.webkitSpeechRecognition; if (!C) return;
    const r = new C(); r.lang = "es-CR"; r.interimResults = false; // the browser asks for microphone permission here
    r.onresult = (e) => setText((t) => (t ? t + " " : "") + e.results[0][0].transcript);
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    rec.current = r; setListening(true); r.start();
  }

  return (
    <>
      <PageHeader eyebrow="COPILOTO" title="Pregúntale a tu bitácora" subtitle="Responde con los registros reales de tu organización. Solo consulta: no cambia datos." />
      <div className="flex flex-wrap gap-2 mb-4"><span className="text-sm text-muted-foreground self-center">Para registrar, paso a paso:</span>{GUIDED.map((g) => <Link key={g.to} to={g.to} className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent">{g.l}</Link>)}</div>
      <div className="rounded-xl border border-border bg-card p-4 min-h-[300px] space-y-3">
        {msgs.length === 0 && <div className="flex flex-wrap gap-2">{EXAMPLES.map((e) => <Button key={e} size="sm" variant="outline" onClick={() => void send(e)}>{e}</Button>)}
          {buyer ? <Button size="sm" variant="outline" onClick={() => void send(`Resume las compras del cliente ${buyer}`)}>{`Resume las compras del cliente ${buyer}`}</Button>
            : <Button size="sm" variant="outline" onClick={() => setText("Resume las compras del cliente ")}>Resumen de un cliente (escribe su nombre)</Button>}</div>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div className={"inline-block max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap text-left " +
              (m.role === "user" ? "bg-primary text-primary-foreground" : m.error ? "border border-destructive text-destructive" : "bg-muted")}>{m.content}</div>
            {m.meta && <div className="text-[11px] text-muted-foreground mt-1">{m.meta}</div>}
          </div>))}
        {busy && <p className="text-sm text-muted-foreground">Consultando tus registros…</p>}
        <div ref={end} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe tu pregunta…" className="flex-1"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} />
        {voice && <Button type="button" variant="outline" onClick={toggleVoice} aria-label="Dictar">{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>}
        <Button type="submit" disabled={busy || !text.trim()} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">Usa la API de OpenAI. Cada pregunta tiene un costo en la cuenta de OpenAI del autor.</p>
    </>
  );
}
