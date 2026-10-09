/** Stable union of column names in first-seen order across ALL rows. */
export function csvColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) seen.add(k);
  return [...seen];
}

const NUMERIC = /^[-+]?\d+([.,]\d+)?$/;
/** Escapes one cell: quotes when needed and neutralizes spreadsheet formulas (=, +, -, @, tab, CR) in text, never in numbers. */
export function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s) && !NUMERIC.test(s)) s = "'" + s;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds a CSV string from rows that may have different columns; missing values are empty. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = csvColumns(rows);
  return [headers.map(csvCell).join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): boolean {
  if (typeof window === "undefined" || !rows.length) return false;
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}
