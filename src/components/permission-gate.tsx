import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useCan, type Permission } from "@/lib/permissions";

interface Props {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
  /** When true, renders a subtle hint instead of nothing. */
  hint?: boolean;
}

export function PermissionGate({ permission, fallback, children, hint }: Props) {
  const allowed = useCan(permission);
  if (allowed) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  if (hint) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" /> Sin permiso
      </span>
    );
  }
  return null;
}
