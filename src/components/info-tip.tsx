import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface InfoTipProps {
  text: string;
  className?: string;
}

/** Pequeño icono con explicación en lenguaje simple. */
export function InfoTip({ text, className }: InfoTipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Más información"
            className={"inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition " + (className ?? "")}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-center leading-snug">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Glosario reutilizable de términos del beneficio. */
export const glossary = {
  inventarioLibre: "Inventario libre: café que podés negociar.",
  inventarioComprometido: "Inventario comprometido: café ya separado para un cliente.",
  inventarioBloqueado: "Inventario bloqueado: café que no debería venderse todavía.",
  merma: "Merma: pérdida o salida del proceso que reduce el inventario útil.",
  fase: "Fase: paso del proceso de beneficio.",
  reservado: "Reservado: café apartado en firme para un cliente, con vencimiento.",
  humedad: "Humedad: porcentaje de agua del café. Ideal entre 9% y 12.5% para vender.",
} as const;
