import { cn } from "@/lib/utils";

type Status = "success" | "warning" | "danger" | "neutral" | "info";

const styles: Record<Status, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  danger: "bg-destructive/15 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  info: "bg-primary/15 text-primary",
};

export function StatusBadge({
  status,
  children,
  className,
}: {
  status: Status;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      {children}
    </span>
  );
}
