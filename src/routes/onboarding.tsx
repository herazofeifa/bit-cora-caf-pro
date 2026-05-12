import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Configura tu finca — Bitácora Café Pro" },
      { name: "description", content: "Configura tu finca o micro-beneficio en pocos pasos." },
    ],
  }),
  component: OnboardingPage,
});

const steps = ["Tu finca", "Ubicación", "Listo"];

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  return (
    <div className="min-h-screen flex flex-col px-6 py-10 bg-background">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= step ? "bg-primary" : "bg-secondary",
              )}
            />
          ))}
        </div>

        <div className="flex-1">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold">Bienvenido</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Empecemos con el nombre de tu finca o beneficio.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="farm">Nombre de la finca</Label>
                <Input id="farm" placeholder="Finca La Esperanza" className="h-12 rounded-xl" />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold">¿Dónde está?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cuéntanos la ubicación y la variedad principal.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc">Ubicación</Label>
                <Input id="loc" placeholder="Región, país" className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="var">Variedad principal</Label>
                <Input id="var" placeholder="Caturra, Geisha, Bourbon..." className="h-12 rounded-xl" />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5 text-center pt-8">
              <h1 className="text-2xl font-semibold">¡Todo listo!</h1>
              <p className="text-sm text-muted-foreground">
                Tu bitácora está preparada. Ya puedes empezar a registrar tus cosechas.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-6">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 h-12 rounded-xl"
            >
              Atrás
            </Button>
          )}
          <Button
            onClick={() => {
              if (step < steps.length - 1) setStep((s) => s + 1);
              else navigate({ to: "/dashboard" });
            }}
            className="flex-1 h-12 rounded-xl"
          >
            {step < steps.length - 1 ? "Siguiente" : "Empezar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
