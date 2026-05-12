import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  Sparkles,
  Sprout,
  PackageOpen,
  Boxes,
  Droplets,
  Gauge,
  ArrowRightLeft,
  Trash2,
  BookmarkCheck,
  Coffee,
  Bell,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const actions: { label: string; icon: typeof Sprout; to: string }[] = [
  { label: "Registrar cosecha", icon: Sprout, to: "/harvest/new" },
  { label: "Registrar recibo", icon: PackageOpen, to: "/intake/new" },
  { label: "Crear lote", icon: Boxes, to: "/lots" },
  { label: "Registrar humedad", icon: Droplets, to: "/assistant" },
  { label: "Registrar variable", icon: Gauge, to: "/variables/new" },
  { label: "Mover fase", icon: ArrowRightLeft, to: "/process-control" },
  { label: "Registrar merma", icon: Trash2, to: "/waste" },
  { label: "Reservar café", icon: BookmarkCheck, to: "/reservations" },
  { label: "Ver café libre", icon: Coffee, to: "/free-coffee" },
  { label: "Ver alertas de hoy", icon: Bell, to: "/alerts" },
];

export function QuickActionFab() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Registrar"
          className="fixed z-50 right-4 bottom-20 md:bottom-6 md:right-6 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3.5 shadow-soft hover:opacity-95 active:scale-95 transition"
        >
          <Plus className="h-5 w-5" />
          <span className="font-semibold">Registrar</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>¿Qué querés hacer?</SheetTitle>
        </SheetHeader>

        <Link
          to="/assistant"
          onClick={() => setOpen(false)}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3.5 hover:bg-primary/10 transition"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground">Abrir asistente guiado</div>
            <div className="text-xs text-muted-foreground">Te llevamos paso a paso.</div>
          </div>
        </Link>

        <ul className="mt-4 space-y-2 pb-4">
          {actions.map(({ label, icon: Icon, to }) => (
            <li key={label}>
              <Link
                to={to}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left hover:bg-accent transition min-h-[60px]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-medium text-foreground">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
