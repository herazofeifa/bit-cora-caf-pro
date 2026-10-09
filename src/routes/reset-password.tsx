import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña — Bitácora Café Pro" },
      { name: "description", content: "Definí una nueva contraseña para tu cuenta." },
      { property: "og:title", content: "Nueva contraseña — Bitácora Café Pro" },
      { property: "og:description", content: "Definí una nueva contraseña para tu cuenta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error("El enlace venció o no es válido. Pedí uno nuevo.");
    toast.success("Contraseña actualizada");
    navigate({ to: "/dashboard" });
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <Toaster />
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
        <div className="space-y-2">
          <Label htmlFor="pw">Contraseña</Label>
          <Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl">Guardar</Button>
      </form>
    </div>
  );
}
