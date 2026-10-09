import { describe, it, expect } from "vitest";
import { toCsv } from "../export-csv";
describe("toCsv", () => {
  it("quotes values containing commas", () => {
    expect(toCsv([{ a: "x,y", b: 2 }])).toBe('a,b\n"x,y",2');
  });
});
