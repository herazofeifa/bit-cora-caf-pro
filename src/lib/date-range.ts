/**
 * Day ranges in the app time zone (Costa Rica, UTC−6, no DST).
 * A user range "desde..hasta" (YYYY-MM-DD, both inclusive) becomes the half-open
 * instant range [start of desde, start of the day after hasta) in CR time.
 */
export const APP_TZ = "America/Costa_Rica";
const CR_OFFSET = "-06:00";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar day (YYYY-MM-DD) in Costa Rica for an instant (default: now). */
export function crDay(at: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}
/** ISO instant of 00:00 Costa Rica on that day. */
export function crDayStart(day: string): string {
  if (!DAY.test(day)) throw new Error("fecha inválida");
  return new Date(`${day}T00:00:00${CR_OFFSET}`).toISOString();
}
export function nextDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10);
}
/** Inclusive day range → { from, toExclusive } ISO instants for `>= from AND < toExclusive`. */
export function crRange(desde: string, hasta: string): { from: string; toExclusive: string } {
  return { from: crDayStart(desde), toExclusive: crDayStart(nextDay(hasta)) };
}
/** True if a timestamp or plain date falls within desde..hasta (inclusive, CR days). */
export function inCrRange(value: string | null | undefined, desde: string, hasta: string): boolean {
  if (!value) return false;
  const day = DAY.test(value) ? value : crDay(value);
  return day >= desde && day <= hasta;
}
