import { describe, it, expect } from "vitest";
import { isEvaluatorAccount, type Membership } from "../auth";

const m = (eval_kind: Membership["eval_kind"]): Membership =>
  ({ organization_id: crypto.randomUUID(), organization_name: "x", role: "administrador", is_demo: !!eval_kind, eval_kind });

describe("cuenta de evaluación", () => {
  it("solo con los dos espacios de evaluación se muestra el selector", () => {
    expect(isEvaluatorAccount([m("blank"), m("sample")])).toBe(true);
  });
  it("una cuenta con la organización original nunca es evaluadora", () => {
    expect(isEvaluatorAccount([m(null), m("sample")])).toBe(false);
    expect(isEvaluatorAccount([])).toBe(false);
  });
});
