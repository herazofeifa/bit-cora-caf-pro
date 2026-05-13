import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";
import { mockDb } from "@/data/mock-data";
import type { Farm, Parcel, Unit } from "@/types/domain";

// ───────────────────────────────────────────────────────────
// Single source of truth for catalogs + app-wide settings.
// Persists to localStorage and notifies all subscribers on
// any mutation so saved changes appear live across the app.
// ───────────────────────────────────────────────────────────

export interface Organization {
  name: string;
  country: string;
  region: string;
}

export interface AppSettings {
  moisture_ideal_min: number;
  moisture_ideal_max: number;
  moisture_warn_margin: number;
  alert_rules: Record<string, boolean>;
  public_default_visible: {
    availability: boolean;
    moisture: boolean;
    quality: boolean;
    tasting_notes: boolean;
    photos: boolean;
    process_details: boolean;
  };
}

interface ConfigState {
  organization: Organization;
  farms: Farm[];
  parcels: Parcel[];
  units: Unit[];
  settings: AppSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  moisture_ideal_min: 9,
  moisture_ideal_max: 12.5,
  moisture_warn_margin: 0.5,
  alert_rules: {
    phase_near_max: true, phase_overdue: true, lot_no_movement: true, lot_missing_variable: true, drying_too_long: true,
    moisture_above: true, moisture_below: true, ph_out_of_range: true, temp_out_of_range: true, water_activity_high: true, quality_pending: true,
    low_inventory: true, reservation_near_expiry: true, reservation_expired: true, over_reservation: true, blocked_for_sale: true,
    missing_required_variable: true, phase_finished_outside: true, experimental_deviation: true, waste_above_avg: true,
  },
  public_default_visible: {
    availability: true, moisture: true, quality: true, tasting_notes: true, photos: true, process_details: false,
  },
};

const DEFAULT_ORG: Organization = {
  name: mockDb.organizations[0]?.name ?? "Bitácora Café Pro",
  country: mockDb.organizations[0]?.country ?? "Costa Rica",
  region: mockDb.organizations[0]?.region ?? "Tarrazú",
};

const STORAGE_KEY = "bcp.app-config.v1";

function loadPersisted(): Partial<ConfigState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const persisted = loadPersisted();

const state: ConfigState = {
  organization: { ...DEFAULT_ORG, ...(persisted.organization ?? {}) },
  farms: Array.isArray(persisted.farms) && persisted.farms.length > 0 ? persisted.farms! : [...mockDb.farms],
  parcels: Array.isArray(persisted.parcels) && persisted.parcels.length > 0 ? persisted.parcels! : [...mockDb.parcels],
  units: Array.isArray(persisted.units) && persisted.units.length > 0 ? persisted.units! : [...mockDb.units],
  settings: {
    ...DEFAULT_SETTINGS,
    ...(persisted.settings ?? {}),
    alert_rules: { ...DEFAULT_SETTINGS.alert_rules, ...((persisted.settings as AppSettings | undefined)?.alert_rules ?? {}) },
    public_default_visible: {
      ...DEFAULT_SETTINGS.public_default_visible,
      ...((persisted.settings as AppSettings | undefined)?.public_default_visible ?? {}),
    },
  },
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

const getSnapshot = () => state;

function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

function useConfig<T>(selector: (s: ConfigState) => T): T {
  return useSyncExternalStoreWithSelector(subscribe, getSnapshot, getSnapshot, selector, shallowEqual);
}

// ───────────── Hooks ─────────────

export const useOrganization = () => useConfig((s) => s.organization);
export const useFarms = () => useConfig((s) => s.farms);
export const useParcels = () => useConfig((s) => s.parcels);
export const useUnits = () => useConfig((s) => s.units);
export const useAppSettings = () => useConfig((s) => s.settings);

// Static getters (for non-React modules)
export const getFarms = () => state.farms;
export const getParcels = () => state.parcels;
export const getUnits = () => state.units;
export const getSettings = () => state.settings;
export const getOrganization = () => state.organization;

// ───────────── Actions ─────────────

export function updateOrganization(patch: Partial<Organization>) {
  state.organization = { ...state.organization, ...patch };
  emit();
}

export function updateFarm(id: string, patch: Partial<Farm>) {
  state.farms = state.farms.map((f) => (f.id === id ? { ...f, ...patch, updated_at: new Date().toISOString() } : f));
  emit();
}

export function updateParcel(id: string, patch: Partial<Parcel>) {
  state.parcels = state.parcels.map((p) => (p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p));
  emit();
}

export function updateUnit(id: string, patch: Partial<Unit>) {
  state.units = state.units.map((u) => (u.id === id ? { ...u, ...patch } : u));
  emit();
}

export function updateSettings(patch: Partial<AppSettings>) {
  state.settings = { ...state.settings, ...patch };
  emit();
}

export function setSettings(next: AppSettings) {
  state.settings = next;
  emit();
}

// ───────────── Helpers ─────────────

export function isMoistureOk(value: number, settings: AppSettings = state.settings) {
  return value >= settings.moisture_ideal_min && value <= settings.moisture_ideal_max;
}

export function moistureStatus(
  value: number | null | undefined,
  settings: AppSettings = state.settings,
): "neutral" | "success" | "warning" | "danger" {
  if (value == null) return "neutral";
  const { moisture_ideal_min: lo, moisture_ideal_max: hi, moisture_warn_margin: m } = settings;
  if (value < lo - m || value > hi + m) return "danger";
  if (value < lo || value > hi) return "warning";
  return "success";
}
