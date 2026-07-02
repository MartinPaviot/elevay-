import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * M12-R1 (outreach-autopilot T7) — drift guard. Static assertions that the
 * outreach_decisions learning record stays wired: every send chokepoint
 * writes it at transport, the shared gate surfaces the resolved send class
 * (so chokepoints never re-derive it), and the writer keeps its best-effort
 * + dedup contract. Kept OUT of cle13-wiring.test.ts on purpose (T7 owns its
 * own guard file).
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("T7 wiring guards (outreach_decisions learning record)", () => {
  it("all five send chokepoints record the outreach decision at transport", () => {
    for (const f of [
      "inngest/email-send-worker.ts", // C1 + C2 (same module)
      "inngest/outbound-smtp-send.ts", // C3
      "lib/emails/deliver-interactive.ts", // C4
      "app/api/meetings/[id]/notes/send-follow-up/route.ts", // C5
    ]) {
      const src = read(f);
      expect(src, `${f} must import the decision writer`).toMatch(
        /from\s+["']@\/lib\/outreach\/decision-record["']/,
      );
      expect(src, `${f} must call recordOutreachDecision`).toContain(
        "recordOutreachDecision(",
      );
    }
    // C1 and C2 live in the same module — both paths must record.
    const worker = read("inngest/email-send-worker.ts");
    const calls = worker.match(/recordOutreachDecision\(/g) ?? [];
    expect(calls.length, "email-send-worker must record on BOTH C1 and C2").toBeGreaterThanOrEqual(2);
  });

  it("the gate returns the resolved send class on success (chokepoints must not re-derive it)", () => {
    const src = read("lib/guardrails/sending-gate.ts");
    expect(src).toMatch(/sendClass\?: SendClass/);
    expect(src).toMatch(/return \{ send: true, reason: decision\.reason, sendClass \}/);
  });

  it("the writer keeps its best-effort + retry-dedup contract", () => {
    const src = read("lib/outreach/decision-record.ts");
    // Inngest-retry dedup: the insert must stay conflict-tolerant.
    expect(src).toContain("onConflictDoNothing");
    // Best-effort: the whole body must stay inside try/catch (a partially
    // mocked schema in tests THROWS at export access — the shield is here).
    expect(src).toMatch(/catch\s*\{/);
    // Reply-class sends must never create a learning record.
    expect(src).toContain('input.sendClass !== "outreach"');
  });

  it("the schema keeps SOFT references (log table never locks business tables)", () => {
    const src = read("db/schema/outreach-learning.ts");
    // Guard the CODE, not the prose — the file's own doc comment legitimately
    // says "NO .references()" and must not trip this (the T2/outreach-cap lesson).
    const code = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    expect(code).not.toContain(".references(");
    expect(code).toContain("outreach_decisions_outbound_email_idx");
  });
});
