import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}

export function MetricCard({ icon: Icon, label, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
