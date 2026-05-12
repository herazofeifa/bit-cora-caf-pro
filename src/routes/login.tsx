import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Bitácora Café Pro" },
      { name: "description", content: "Inicia sesión en tu bitácora digital de campo y beneficio." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <Coffee className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold">Bitácora Café Pro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu bitácora digital de campo y beneficio
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/dashboard" });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" placeholder="tu@correo.com" className="h-12 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" placeholder="••••••••" className="h-12 rounded-xl" />
          </div>
          <Button type="submit" className="w-full h-12 rounded-xl text-base">
            Entrar
          </Button>
          <div className="flex items-center justify-between text-sm">
            <Link to="/onboarding" className="text-primary font-medium">
              Crear cuenta
            </Link>
            <button type="button" className="text-muted-foreground">
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
