import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Coffee, ChevronDown } from "lucide-react";
import { navGroups } from "./nav-items";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of navGroups) {
      initial[g.label] = g.items.some((i) => i.to === pathname) || g.label === "Inicio";
    }
    return initial;
  });

  const toggle = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-sidebar-border md:bg-sidebar">
      <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Coffee className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-base font-semibold">Bitácora</p>
          <p className="text-xs text-muted-foreground">Café Pro</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {navGroups.map((group, gi) => {
          const isOpen = openGroups[group.label] ?? false;
          const hasActive = group.items.some((i) => i.to === pathname);
          return (
            <div key={group.label} className={cn(gi > 0 && "mt-1")}>
              <button
                type="button"
                onClick={() => toggle(group.label)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
                aria-expanded={isOpen}
              >
                <span className={cn(hasActive && "text-foreground")}>{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    isOpen ? "rotate-0" : "-rotate-90",
                  )}
                />
              </button>
              {isOpen && (
                <ul className="mt-1 space-y-1">
                  {group.items.map(({ to, label, icon: Icon }) => {
                    const active = pathname === to;
                    return (
                      <li key={to}>
                        <Link
                          to={to}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent",
                          )}
                        >
                          <Icon className="h-4.5 w-4.5" />
                          <span>{label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
