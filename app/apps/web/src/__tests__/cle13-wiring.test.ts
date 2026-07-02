import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * CLE-13 T10 — drift guard. Static assertions that the orphan stays wired:
 * the shared gate imports enforceSendingIdentity, all five send chokepoints
 * import the shared gate, the send-window path no longer reads UTC wall-clock,
 * and the signal auto-enroll loop routes through the approval authority.
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("CLE-13 wiring guards", () => {
  it("sending-gate imports the orphaned enforceSendingIdentity", () => {
    const src = read("lib/guardrails/sending-gate.ts");
    expect(src).toMatch(/from\s+["']@\/lib\/guardrails\/sending-identity["']/);
    expect(src).toContain("enforceSendingIdentity");
  });

  it("all five send chokepoints import the shared sending gate (evaluateSend)", () => {
    const chokepoints = [
      "inngest/email-send-worker.ts", // C1 + C2 (same module)
      "inngest/outbound-smtp-send.ts", // C3
      "lib/emails/deliver-interactive.ts", // C4
      "app/api/meetings/[id]/notes/send-follow-up/route.ts", // C5
    ];
    for (const f of chokepoints) {
      const src = read(f);
      expect(src, `${f} must import the shared sending gate`).toMatch(
        /from\s+["']@\/lib\/guardrails\/sending-gate["']/,
      );
      expect(src, `${f} must call evaluateSend`).toContain("evaluateSend");
    }
  });

  it("the send-window path no longer reads UTC wall-clock (getUTCDay/getUTCHours)", () => {
    const src = read("inngest/email-send-worker.ts");
    expect(src).not.toContain("getUTCDay");
    expect(src).not.toContain("getUTCHours");
    expect(src).toMatch(/from\s+["']@\/lib\/emails\/send-window["']/);
    expect(src).toContain("isWithinSendWindow");
  });

  it("signalAutoEnroll routes through the approval authority before enrolling", () => {
    const src = read("inngest/signal-to-sequence.ts");
    expect(src).toContain("enforceAgentApprovalMode");
    expect(src).toContain("approval-gate");
    expect(src).toContain("recordAgentAction");
  });
});

describe("INV-1 wiring guards (tenant daily outreach cap)", () => {
  it("the cap is a compiled constant — no env, no config read anywhere in the module", () => {
    const src = read("lib/guardrails/outreach-cap.ts");
    expect(src).toContain("OUTREACH_DAILY_TENANT_CAP = 100");
    expect(src).not.toMatch(/process\.env/);
    // Guard the IMPORT, not the prose (the module's doc comment legitimately
    // says "no tenant-settings key" — that must not trip the guard).
    expect(src).not.toMatch(/from\s+["']@\/lib\/config\/tenant-settings["']/);
  });

  it("the shared gate consumes the cap slot and exposes the block code", () => {
    const src = read("lib/guardrails/sending-gate.ts");
    expect(src).toContain("consumeOutreachCapSlot");
    expect(src).toContain("daily_cap_reached");
  });

  it("the cap never becomes a tenant setting", () => {
    const src = read("lib/config/tenant-settings.ts");
    expect(src).not.toContain("OUTREACH_DAILY_TENANT_CAP");
    expect(src).not.toMatch(/outreachDailyCap/i);
  });
});

describe("M13-R8 wiring guards (manual-send pregate)", () => {
  it("the composer pregates manual sends (G2+G5) BEFORE calling /api/emails/send", () => {
    const src = read("components/email-composer-panel.tsx");
    expect(src).toContain("/api/send/pregate");
    expect(src.indexOf("/api/send/pregate")).toBeLessThan(src.indexOf("/api/emails/send"));
  });

  it("the pregate never calls an LLM (deterministic G2 layer only)", () => {
    const src = read("app/api/send/pregate/route.ts");
    expect(src).toContain("decideFabricationGate");
    expect(src).not.toMatch(/generateText|generateObject|anthropic|judgeFabrication/);
  });
});
