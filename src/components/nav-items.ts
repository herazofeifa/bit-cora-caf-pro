import {
  Home,
  Sprout,
  PackageOpen,
  Boxes,
  Workflow,
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
  Bell,
  ScrollText,
  Bot,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Inicio",
    items: [
      { to: "/dashboard", label: "Inicio", icon: Home },
      { to: "/copiloto", label: "Copiloto", icon: Bot },
    ],
  },
  {
    label: "Campo y recibos",
    items: [
      { to: "/harvest", label: "Cosecha", icon: Sprout },
      { to: "/intake", label: "Recibos", icon: PackageOpen },
      { to: "/variables", label: "Variables", icon: Beaker },
    ],
  },
  {
    label: "Lotes y proceso",
    items: [
      { to: "/lots", label: "Lotes", icon: Boxes },
      { to: "/processes", label: "Procesos", icon: Workflow },
      { to: "/quality", label: "Calidad", icon: Award },
      { to: "/waste", label: "Mermas", icon: Trash2 },
    ],
  },
  {
    label: "Inventario y ventas",
    items: [
      { to: "/inventory", label: "Inventario", icon: Warehouse },
      { to: "/free-coffee", label: "Café libre", icon: Coffee },
      { to: "/customers", label: "Clientes", icon: Users },
      { to: "/reservations", label: "Reservas", icon: BookmarkCheck },
    ],
  },
  {
    label: "Gestión",
    items: [
      { to: "/reports", label: "Reportes", icon: BarChart3 },
      { to: "/traceability", label: "Trazabilidad", icon: GitBranch },
      { to: "/alerts", label: "Alertas", icon: Bell },
      { to: "/audit", label: "Auditoría", icon: ScrollText },
      { to: "/settings", label: "Ajustes", icon: Settings },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

export const bottomNavRoutes = ["/dashboard", "/harvest", "/lots", "/inventory"];
