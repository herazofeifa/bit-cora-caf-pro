import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/export-csv";

describe("report CSV", () => {
  const rows = [
    { seccion: "Producción por finca", Finca: "Finca El Mirador", kg: 1450 },
    { seccion: "Café libre por variedad", Variedad: "Caturra", "kg libres": 118 },
    { seccion: "Café libre por variedad", Variedad: "Mezcla", "kg libres": 160 },
    { seccion: "Ventas entregadas", Moneda: "USD", Entregas: 1, "kg entregados": 30, "Precio ponderado / kg": 6.8 },
    { seccion: "Ventas entregadas", Moneda: "CRC", Entregas: 1, "kg entregados": 20, "Precio ponderado / kg": 4000 },
  ];
  const lines = toCsv(rows).split("\n");
  const head = lines[0].split(",");

  it("header has the union of every section's columns", () => {
    expect(head).toEqual(["seccion", "Finca", "kg", "Variedad", "kg libres", "Moneda", "Entregas", "kg entregados", "Precio ponderado / kg"]);
  });
  it("free coffee 118 and 160 kg land in the kg libres column", () => {
    expect(lines[2].split(",")[head.indexOf("kg libres")]).toBe("118");
    expect(lines[3].split(",")[head.indexOf("kg libres")]).toBe("160");
  });
  it("USD 6.8 and CRC 4000 stay separate, missing cells empty", () => {
    expect(lines[4]).toBe("Ventas entregadas,,,,,USD,1,30,6.8");
    expect(lines[5]).toBe("Ventas entregadas,,,,,CRC,1,20,4000");
  });
  it("neutralizes formulas in text but keeps numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("@cliente")).toBe("'@cliente");
    expect(csvCell("+506 8888")).toBe("'+506 8888");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("-12.5")).toBe("-12.5");
  });
});
