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

describe("M13-G1 wiring guards (enrollment chokepoints)", () => {
  it("every enrollment chokepoint loads the G1 context (fresh signal + ICP fit)", () => {
    for (const f of [
      "app/api/sequences/[id]/enroll/route.ts",
      "app/api/sequences/[id]/autopilot/route.ts",
      "lib/chat/tools/account-lists.ts",
      "lib/chat/tools/action.ts",
      "inngest/signal-to-sequence.ts",
      "lib/autopilot/enroll.ts",
      // T6 — the two holes T5 missed: the approval executor is the REAL
      // write for every deferred enrollment (re-verifies freshness at
      // approval time, M2-R4).
      "lib/agents/action-executors.ts",
    ]) {
      expect(read(f), f).toContain("loadG1Context");
    }
  });
});

describe("M13-T6 wiring guards (gate_decisions verdicts)", () => {
  it("every G1 chokepoint writes its verdict into gate_decisions", () => {
    for (const f of [
      "app/api/sequences/[id]/enroll/route.ts",
      "app/api/sequences/[id]/autopilot/route.ts",
      "lib/chat/tools/account-lists.ts",
      "lib/chat/tools/action.ts",
      "inngest/signal-to-sequence.ts",
      "lib/autopilot/enroll.ts",
      "lib/agents/action-executors.ts",
    ]) {
      expect(read(f), f).toMatch(/recordGateDecisions?|recordGate/);
    }
  });

  it("G5 at transport and the manual pregate write their verdicts", () => {
    expect(read("lib/guardrails/sending-gate.ts")).toContain("recordGateDecision");
    expect(read("app/api/send/pregate/route.ts")).toContain("recordGateDecisions");
  });

  it("the sequence-generator logs G2 + G4 verdicts", () => {
    const src = read("lib/agents/sequence-generator.ts");
    expect(src).toContain("recordGateDecision");
    expect(src).toContain("GATE_RUBRICS.g2Deterministic");
    expect(src).toContain("GATE_RUBRICS.g4Sequence");
  });

  it("the draft router runs the G4 gate — drafts are born gates_running", () => {
    const src = read("inngest/sequence-draft-router.ts");
    expect(src).toContain("runDraftG4Gate");
    expect(src).toContain('status: "gates_running"');
  });

  it("the expiry cron reaps drafts stuck mid-gate", () => {
    const src = read("inngest/sequence-draft-expiry.ts");
    for (const s of ["gates_running", "blocked", "reworking"]) {
      expect(src).toContain(s);
    }
  });

  it("the G4 threshold stays the central passThresholdFor — no new knob", () => {
    expect(read("inngest/sequence-draft-router.ts")).toContain("passThresholdFor");
    expect(read("lib/sequence-drafts/gate-runner.ts")).not.toMatch(/process\.env/);
  });
});

describe("M13-T6b wiring guards (G2 on every generation path)", () => {
  it("every LLM body-generation seam runs the fabrication gate AND logs its verdict", () => {
    for (const f of [
      "inngest/reply-handler.ts", // positive + objection replies (can auto-send)
      "inngest/reply-agent.ts", // delegated classifications (can auto-send)
      "lib/chat/tools/action.ts", // generateFollowUpEmail + suggestEmailReply
      "lib/copy/personalization/db-shadow.ts", // copy engine source
      "inngest/functions.ts", // sendSequenceStep — the default AUTO-mode path
      "lib/sequence/db-conductor.ts", // V2 conductor sendEmail port
    ]) {
      expect(read(f), f).toMatch(/applyG2FabricationGate|decideFabricationGate/);
      expect(read(f), f).toMatch(/recordGateDecisions?\(/);
    }
  });

  it("a blocked auto-send can only ever become a draft (forceDraft seam)", () => {
    const hold = read("lib/emails/outbound-hold.ts");
    expect(hold).toContain("forceDraft");
    // The downgrade must clear queuedAt — the send worker picks up queued/held only.
    expect(hold).toMatch(/forceDraft\s*\?\s*"draft"/);
    expect(read("inngest/functions.ts")).toContain("forceDraft: g2.blocked");
    expect(read("lib/sequence/db-conductor.ts")).toContain("forceDraft");
  });

  it("the reply gate helper stays the single shared implementation", () => {
    const helper = read("lib/reply/g2-fabrication.ts");
    expect(helper).toContain("applyG2FabricationGate");
    expect(helper).toContain("judgeFabrication");
    // Both auto-send-capable reply modules import IT, not their own copy.
    expect(read("inngest/reply-handler.ts")).toMatch(/from\s+["']@\/lib\/reply\/g2-fabrication["']/);
    expect(read("inngest/reply-agent.ts")).toMatch(/from\s+["']@\/lib\/reply\/g2-fabrication["']/);
  });

  it("interactive/bulk deterministic paths never call the semantic judge", () => {
    expect(read("lib/chat/tools/action.ts")).not.toContain("judgeFabrication");
    expect(read("lib/copy/personalization/db-shadow.ts")).not.toContain("judgeFabrication");
  });

  it("extraGroundTruth extends the whitelist without arming down the gate", () => {
    const gate = read("lib/evals/fabrication-gate.ts");
    expect(gate).toContain("extraGroundTruth");
    // briefHasFacts must never be derived from extraGroundTruth.
    expect(gate).toMatch(/briefHasSourcedFacts\(input\.brief\)/);
  });
});
