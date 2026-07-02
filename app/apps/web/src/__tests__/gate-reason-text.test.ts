import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gateReasonText } from "@/lib/sequence-drafts/gate-reason";

/**
 * T11c follow-up — the "gate fautif ET la raison" Done item: gateReasonText
 * turns each gate's heterogeneous reasons jsonb into a one-line human why.
 */

describe("gateReasonText", () => {
  it("G1 surfaces the eligibility reason code", () => {
    expect(gateReasonText(1, { reason: "no_fresh_signal" })).toBe("no_fresh_signal");
    expect(gateReasonText(1, {})).toBeNull();
  });

  it("G2 lists the unverifiable claims (capped)", () => {
    expect(gateReasonText(2, { ungrounded: ["3,848", "supabase", "n8n", "keycloak"] })).toBe(
      "Unverifiable: 3,848, supabase, n8n",
    );
    expect(gateReasonText(2, { ungrounded: [] })).toBeNull();
  });

  it("G4 prefers grader issues, falls back to the threshold", () => {
    expect(gateReasonText(4, { issues: ["too generic", "no CTA"] })).toBe("too generic, no CTA");
    expect(gateReasonText(4, { threshold: 0.7 })).toBe("Below quality threshold 0.7");
    expect(gateReasonText(4, {})).toBeNull();
  });

  it("G5 lists the transport failures", () => {
    expect(gateReasonText(5, { failures: ["spam:viagra", "links:4"] })).toBe(
      "Content: spam:viagra, links:4",
    );
  });

  it("null/garbage reasons never throw", () => {
    expect(gateReasonText(2, null)).toBeNull();
    expect(gateReasonText(4, "nope")).toBeNull();
    expect(gateReasonText(9, {})).toBeNull();
  });
});

describe("T11c follow-up render guard", () => {
  it("the gates section shows the reason line for a non-pass verdict", () => {
    const src = readFileSync(
      join(__dirname, "..", "components", "sequence-draft-preview.tsx"),
      "utf8",
    );
    expect(src).toMatch(/g\.verdict !== "pass" && g\.reason/);
  });
});
