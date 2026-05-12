import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Severity = "normal" | "warning" | "critical";

const toneMap: Record<Severity, { bar: string; chip: string; label: string }> = {
  normal: { bar: "bg-primary/70", chip: "bg-primary/15 text-primary", label: "Normal" },
  warning: { bar: "bg-warning", chip: "bg-warning/25 text-warning-foreground", label: "Atención" },
  critical: { bar: "bg-destructive", chip: "bg-destructive/15 text-destructive", label: "Urgente" },
};

interface ActionCardProps {
  icon: LucideIcon;
  lotCode?: string;
  title: string;
  description?: string;
  severity?: Severity;
  actions?: ReactNode;
}

export function ActionCard({
  icon: Icon,
  lotCode,
  title,
  description,
  severity = "normal",
  actions,
}: ActionCardProps) {
  const tone = toneMap[severity];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className={cn("absolute left-0 top-0 h-full w-1.5", tone.bar)} />
      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {lotCode && (
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  {lotCode}
                </span>
              )}
              <span
                className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", tone.chip)}
              >
                {tone.label}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="mt-3 flex flex-wrap gap-2 pl-13 sm:pl-13">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
