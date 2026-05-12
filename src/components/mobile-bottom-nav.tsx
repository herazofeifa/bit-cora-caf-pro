import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Sprout, Boxes, Warehouse, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { navItems, bottomNavRoutes } from "./nav-items";
import { cn } from "@/lib/utils";

const primary = [
  { to: "/dashboard", label: "Inicio", icon: Home },
  { to: "/harvest", label: "Cosecha", icon: Sprout },
  { to: "/lots", label: "Lotes", icon: Boxes },
  { to: "/inventory", label: "Inventario", icon: Warehouse },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const moreItems = navItems.filter((i) => !bottomNavRoutes.includes(i.to));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {primary.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-xs",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="flex w-full flex-col items-center justify-center gap-1 py-2.5 text-xs text-muted-foreground">
                <Menu className="h-5 w-5" />
                <span className="font-medium">Más</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl">
              <SheetHeader>
                <SheetTitle>Más opciones</SheetTitle>
              </SheetHeader>
              <ul className="mt-4 grid grid-cols-3 gap-2 pb-4">
                {moreItems.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      onClick={() => setOpen(false)}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center text-xs font-medium hover:bg-accent"
                    >
                      <Icon className="h-5 w-5 text-primary" />
                      <span>{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
