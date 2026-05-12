import { useSyncExternalStore } from "react";

// ───────────── Roles ─────────────

export type AppRole =
  | "administrador"
  | "encargado_beneficio"
  | "productor"
  | "comercial"
  | "consulta";

export const roleLabel: Record<AppRole, string> = {
  administrador: "Administrador",
  encargado_beneficio: "Encargado de beneficio",
  productor: "Productor / finca",
  comercial: "Comercial",
  consulta: "Consulta",
};

export const roleDescription: Record<AppRole, string> = {
  administrador: "Configura todo, gestiona usuarios y procesos.",
  encargado_beneficio: "Registra recibos, mueve lotes, variables, humedad y mermas.",
  productor: "Registra cosecha y consulta sus lotes.",
  comercial: "Inventario disponible, clientes y reservas.",
  consulta: "Solo lectura de reportes y trazabilidad.",
};

// ───────────── Permissions ─────────────

export type Permission =
  // Lots & process
  | "lot.create" | "lot.edit" | "lot.delete" | "lot.split_merge"
  | "phase.move" | "phase.override"
  | "variable.log" | "variable.override_required"
  | "moisture.log"
  // Inventory
  | "intake.create" | "stock.move" | "stock.adjust" | "stock.sell"
  | "waste.log"
  // Commercial
  | "customer.manage" | "reservation.create" | "reservation.cancel" | "reservation.deliver"
  // Quality
  | "quality.record" | "quality.change_status" | "quality.admin_override"
  // Admin
  | "settings.manage" | "users.manage" | "process_template.manage" | "audit.view"
  // Read
  | "reports.view" | "traceability.view" | "inventory.view";

const ALL: Permission[] = [
  "lot.create","lot.edit","lot.delete","lot.split_merge","phase.move","phase.override",
  "variable.log","variable.override_required","moisture.log",
  "intake.create","stock.move","stock.adjust","stock.sell","waste.log",
  "customer.manage","reservation.create","reservation.cancel","reservation.deliver",
  "quality.record","quality.change_status","quality.admin_override",
  "settings.manage","users.manage","process_template.manage","audit.view",
  "reports.view","traceability.view","inventory.view",
];

const READ: Permission[] = ["reports.view","traceability.view","inventory.view"];

export const rolePermissions: Record<AppRole, Permission[]> = {
  administrador: ALL,
  encargado_beneficio: [
    "intake.create","lot.create","lot.edit","phase.move","variable.log","moisture.log",
    "stock.move","stock.adjust","waste.log","quality.record",
    ...READ,
  ],
  productor: [
    "intake.create", "lot.create",
    ...READ,
  ],
  comercial: [
    "customer.manage","reservation.create","reservation.cancel","reservation.deliver","stock.sell",
    ...READ,
  ],
  consulta: [...READ, "audit.view"],
};

// ───────────── Current role store (persistent) ─────────────

const STORAGE_KEY = "bcp.currentRole";
let currentRole: AppRole = readInitial();

function readInitial(): AppRole {
  if (typeof window === "undefined") return "administrador";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY) as AppRole | null;
    if (v && v in rolePermissions) return v;
  } catch {}
  return "administrador";
}

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function setCurrentRole(role: AppRole) {
  currentRole = role;
  try { window.localStorage.setItem(STORAGE_KEY, role); } catch {}
  listeners.forEach((l) => l());
}

export function getCurrentRole(): AppRole {
  return currentRole;
}

export function useCurrentRole(): AppRole {
  return useSyncExternalStore(subscribe, () => currentRole, () => currentRole);
}

export function can(permission: Permission, role: AppRole = currentRole): boolean {
  return rolePermissions[role].includes(permission);
}

export function useCan(permission: Permission): boolean {
  const role = useCurrentRole();
  return can(permission, role);
}
