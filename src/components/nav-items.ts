import {
  Home,
  Sprout,
  PackageOpen,
  Boxes,
  Workflow,
  Activity,
  Beaker,
  Warehouse,
  Coffee,
  Users,
  BookmarkCheck,
  Trash2,
  Award,
  BarChart3,
  GitBranch,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: Home },
  { to: "/harvest", label: "Cosecha", icon: Sprout },
  { to: "/intake", label: "Recibos", icon: PackageOpen },
  { to: "/lots", label: "Lotes", icon: Boxes },
  { to: "/processes", label: "Procesos", icon: Workflow },
  { to: "/process-control", label: "Control de proceso", icon: Activity },
  { to: "/variables", label: "Variables", icon: Beaker },
  { to: "/inventory", label: "Inventario", icon: Warehouse },
  { to: "/free-coffee", label: "Café libre", icon: Coffee },
  { to: "/customers", label: "Clientes", icon: Users },
  { to: "/reservations", label: "Reservas", icon: BookmarkCheck },
  { to: "/waste", label: "Mermas", icon: Trash2 },
  { to: "/quality", label: "Calidad", icon: Award },
  { to: "/reports", label: "Reportes", icon: BarChart3 },
  { to: "/traceability", label: "Trazabilidad", icon: GitBranch },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

export const bottomNavRoutes = ["/dashboard", "/harvest", "/lots", "/inventory"];
