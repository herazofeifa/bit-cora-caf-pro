import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-base text-muted-foreground max-w-xl">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
