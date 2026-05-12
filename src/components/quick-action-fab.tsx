import { useState } from "react";
import { Plus, Sprout, PackageOpen, Boxes, Droplets, Gauge, ArrowRightLeft, Trash2, BookmarkCheck, Truck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

const actions = [
  { label: "Nueva cosecha", icon: Sprout },
  { label: "Nuevo recibo", icon: PackageOpen },
  { label: "Crear lote", icon: Boxes },
  { label: "Registrar humedad", icon: Droplets },
  { label: "Registrar variable", icon: Gauge },
  { label: "Mover fase", icon: ArrowRightLeft },
  { label: "Registrar merma", icon: Trash2 },
  { label: "Reservar café", icon: BookmarkCheck },
  { label: "Registrar salida", icon: Truck },
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
          <SheetTitle>¿Qué quieres registrar?</SheetTitle>
        </SheetHeader>
        <ul className="mt-4 space-y-2 pb-4">
          {actions.map(({ label, icon: Icon }) => (
            <li key={label}>
              <button
                onClick={() => {
                  setOpen(false);
                  toast(label, { description: "Próximamente disponible" });
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left hover:bg-accent transition"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-medium text-foreground">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
