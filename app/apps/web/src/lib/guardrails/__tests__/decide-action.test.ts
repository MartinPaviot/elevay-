import { describe, it, expect } from "vitest";
import { decideAction, type DecideActionInput } from "@/lib/guardrails/decide-action";

function input(
  action: Partial<DecideActionInput["action"]>,
  role: DecideActionInput["role"] = "member",
): DecideActionInput {
  return {
    action: { mutating: false, confirm: "never", ...action },
    approvalMode: "review-each",
    role,
  };
}

describe("decideAction (CLE-04 stub) — full disposition matrix", () => {
  it("viewer + mutating → refuse", () => {
    expect(decideAction(input({ mutating: true }, "viewer")).disposition).toBe("refuse");
  });
  it("viewer + outbound → refuse", () => {
    expect(decideAction(input({ outbound: true }, "viewer")).disposition).toBe("refuse");
  });
  it("viewer + pure read → execute", () => {
    expect(decideAction(input({ mutating: false }, "viewer")).disposition).toBe("execute");
  });
  it("outbound + money → confirm", () => {
    expect(decideAction(input({ mutating: true, outbound: true, cost: "money" })).disposition).toBe("confirm");
  });
  it("outbound (non-money) → confirm", () => {
    expect(decideAction(input({ mutating: true, outbound: true })).disposition).toBe("confirm");
  });
  it("mutating + irreversible → confirm", () => {
    expect(decideAction(input({ mutating: true, reversible: false })).disposition).toBe("confirm");
  });
  it("mutating + reversible + confirm:never → execute", () => {
    expect(decideAction(input({ mutating: true, reversible: true, confirm: "never" })).disposition).toBe("execute");
  });
  it("mutating + reversible + confirm:risky → confirm", () => {
    expect(decideAction(input({ mutating: true, reversible: true, confirm: "risky" })).disposition).toBe("confirm");
  });
  it("mutating + reversible + confirm:always → confirm", () => {
    expect(decideAction(input({ mutating: true, reversible: true, confirm: "always" })).disposition).toBe("confirm");
  });
  it("pure read → execute", () => {
    expect(decideAction(input({ mutating: false })).disposition).toBe("execute");
  });
  it("every result carries a non-empty reason", () => {
    expect(decideAction(input({ mutating: true, reversible: false })).reason.length).toBeGreaterThan(0);
  });
  it("accepts the optional 2nd arg without changing the base decision (signature parity)", () => {
    const a = decideAction(input({ mutating: false }));
    const b = decideAction(input({ mutating: false }), { actionKey: "x", learnedThresholds: { x: 0.5 } });
    expect(b.disposition).toBe(a.disposition);
  });
});
