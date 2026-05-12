import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Pequeña etiqueta editorial en mayúsculas. Ej. "INVENTARIO". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Usá italic en páginas editoriales (ej. trazabilidad pública). */
  italic?: boolean;
}

export function PageHeader({ eyebrow, title, subtitle, action, italic }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 md:mb-8">
      <div className="space-y-2">
        {eyebrow && <span className="eyebrow block">{eyebrow}</span>}
        <h1
          className={
            "font-serif text-2xl md:text-4xl font-medium tracking-tight text-foreground " +
            (italic ? "italic" : "")
          }
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Sección dentro de una página con eyebrow + título serif compacto. */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
      <div className="space-y-1.5">
        {eyebrow && <span className="eyebrow block">{eyebrow}</span>}
        <h2 className="font-serif text-xl md:text-3xl font-medium tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Etiqueta editorial pequeña en mayúsculas. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={"eyebrow " + (className ?? "")}>{children}</span>;
}
