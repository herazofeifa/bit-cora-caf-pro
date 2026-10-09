import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Coffee } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { startAuth, useSession } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Bitácora Café Pro" },
      { name: "description", content: "Inicia sesión en tu bitácora digital de campo y beneficio." },
      { property: "og:title", content: "Entrar — Bitácora Café Pro" },
      { property: "og:description", content: "Inicia sesión en tu bitácora digital de campo y beneficio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { startAuth(); }, []);
  useEffect(() => { if (session) navigate({ to: "/dashboard", replace: true }); }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/login", data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Revisá tu correo para confirmar la cuenta.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo entrar");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/login" });
    if (r.error) toast.error("No se pudo entrar con Google");
  };

  const forgot = async () => {
    if (!email) return toast.info("Escribí tu correo primero.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/login" });
    if (error) toast.error(error.message); else toast.success("Te enviamos un correo para cambiar la contraseña.");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-background">
      <Toaster />
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <Coffee className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold">Bitácora Café Pro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "in" ? "Tu bitácora digital de campo y beneficio" : "Creá tu cuenta"}
          </p>
        </div>

        <Button type="button" variant="outline" className="w-full h-12 rounded-xl mb-4" onClick={google}>
          Continuar con Google
        </Button>
        <div className="text-center text-xs text-muted-foreground mb-4">o con tu correo</div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "up" && (
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl" required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className="h-12 rounded-xl" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-12 rounded-xl" required />
          </div>
          <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl text-base">
            {mode === "in" ? "Entrar" : "Crear cuenta"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="text-primary font-medium" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Crear cuenta" : "Ya tengo cuenta"}
            </button>
            {mode === "in" && (
              <button type="button" className="text-muted-foreground" onClick={forgot}>¿Olvidaste tu contraseña?</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
