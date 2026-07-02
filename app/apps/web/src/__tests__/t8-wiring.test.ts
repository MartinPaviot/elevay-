import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * M12 (outreach-autopilot T8) — drift guards. Static assertions that
 * (a) the decision↔outcome join stays wired: the writer opens a watcher the
 *     detector can resolve, and resolveOutcome backfills outcome_id with the
 *     terminal-failed exclusion;
 * (b) the founder ban on opens stays enforced: email_opened is never a
 *     learning signal, decision trigger, sequence-branching input or
 *     prioritization feed. Opens remain LEGITIMATE as deliverability
 *     diagnostics + capture instrumentation (openedAt, activities, pipeline
 *     tracking) — those are deliberately NOT guarded here.
 *
 * Guards the CODE, not the prose (the T2/T7 lesson): comment lines are
 * stripped before the banned-string checks. Kept OUT of cle13-wiring.test.ts
 * on purpose (T8 owns its own guard file).
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Drop `//` and `*` comment lines so a doc comment can't trip a ban check. */
const codeOf = (rel: string) =>
  read(rel)
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

describe("T8 wiring — decision↔outcome join", () => {
  it("the writer opens the outcome watcher with the resolver's join keys", () => {
    const code = codeOf("lib/outreach/decision-record.ts");
    expect(code).toContain("createOutcomeWatcher");
    expect(code).toContain('actionType: "outreach-send"');
    // RETURNING is the write detector: no row returned (ON CONFLICT no-op)
    // must mean no watcher.
    expect(code).toMatch(/\.onConflictDoNothing\(\)[\s\S]{0,400}\.returning\(/);
    expect(code).toContain("decisionId");
    expect(code).toContain("outboundEmailId: input.outboundEmailId");
  });

  it("the watcher vocabulary resolves: outreach-send -> email_reply (the detector's shape)", () => {
    const code = codeOf("lib/outcomes/create-watcher.ts");
    expect(code).toMatch(/"outreach-send":\s*168/);
    expect(code).toMatch(/"outreach-send":\s*"email_reply"/);
  });

  it("resolveOutcome backfills outcome_id, idempotently, with the phantom-send exclusion", () => {
    const code = codeOf("lib/outcomes/resolve.ts");
    expect(code).toContain("backfillOutreachDecision");
    // Exactly-once rail: only a NULL outcome_id may be filled.
    expect(code).toContain("isNull(outreachDecisions.outcomeId)");
    // T7 amendment as a POSITIVE list (review fix): the outbound row must
    // prove the send LEFT — covers 'failed' AND stuck-queued/held rows; a
    // bounce is a real send whose -0.8 outcome is honest learning.
    expect(code).toContain('outbound.status === "sent"');
    expect(code).toContain('outbound.status === "delivered"');
    expect(code).toContain('outbound.status === "bounced"');
    expect(code).toContain("outbound.sentAt != null");
    expect(code).not.toContain('"permanent"');
    // Real-time email events resolve the T8 watchers too — outreach-send is
    // in the shared email-family set (T12 factored the literal comparison
    // into EMAIL_FAMILY_ACTION_TYPES; the guard follows the structure).
    expect(code).toContain('"outreach-send"');
    expect(code).toContain("EMAIL_FAMILY_ACTION_TYPES");
  });
});

describe("T8 wiring — the opens ban (email_opened is never decisional)", () => {
  it("campaign-decision-engine: no opens in state, prompt, rules, or bridge triggers", () => {
    const code = codeOf("inngest/campaign-decision-engine.ts");
    expect(code).not.toContain("email_opened");
    expect(code).not.toContain("email/opened");
    expect(code).not.toContain(".openedAt");
    expect(code).not.toContain("state.opens");
    expect(code).not.toMatch(/Opens:/);
    expect(code).not.toContain("opened 3+ times");
    expect(code).not.toContain("multi-open");
    // Clicks / visits / timers stay.
    expect(code).toContain('{ event: "email/clicked" }');
    expect(code).toContain('{ event: "inbound/visit-identified" }');
  });

  it("up-next route: the feed source is clicks (clicked_at), never email_opened", () => {
    const code = codeOf("app/api/home/up-next/route.ts");
    expect(code).not.toContain("email_opened");
    expect(code).not.toContain("aggregateOpens");
    // The honest click source: activities has no email_clicked type (clicks
    // were logged as email_opened there), so the feed reads
    // outbound_emails.clicked_at — first click per email.
    expect(code).toContain("aggregateClicks");
    expect(code).toContain("outboundEmails.clickedAt");
    const lib = codeOf("lib/home/up-next.ts");
    expect(lib).not.toContain('"open"');
    expect(lib).toContain('kind: "click"');
  });

  it("agent-reactor: email_opened is hard-skipped BEFORE decisioning and gone from the vocabulary", () => {
    const reactor = codeOf("inngest/agent-reactor.ts");
    // The hard early-skip — an in-flight/legacy event must never reach the
    // LLM now the heuristic no-action entry is gone.
    expect(reactor).toMatch(/data\.trigger as string\) === "email_opened"/);
    expect(reactor).toMatch(
      /=== "email_opened"\)[\s\S]{0,400}?return \{ skipped: true/,
    );
    // The trigger union and prompt vocabulary no longer carry it.
    expect(codeOf("lib/agent-reactor/types.ts")).not.toContain("email_opened");
    expect(codeOf("lib/agent-reactor/decision-prompt.ts")).not.toContain("email_opened");
  });

  it("resend webhook: opens are never bridged to the agent reactor (clicks/bounces stay)", () => {
    const code = codeOf("app/api/webhooks/resend/route.ts");
    // Scope to the agent-reactor trigger map: the pipeline stageMap ABOVE it
    // legitimately keeps email.opened (capture instrumentation, not a
    // decision trigger).
    const start = code.indexOf("triggerMap: Record<string, AgentTrigger>");
    expect(start).toBeGreaterThan(-1);
    const block = code.slice(start, code.indexOf("};", start));
    expect(block).not.toContain("email.opened");
    expect(block).not.toContain("email_opened");
    expect(block).toContain('"email.clicked": "email_clicked"');
    expect(block).toContain('"email.bounced": "email_bounced"');
  });

  it("resolve: opens never resolve a watcher and never carry a positivity", () => {
    const code = codeOf("lib/outcomes/resolve.ts");
    // The POSITIVITY map must not learn from opens...
    expect(code).not.toMatch(/email_opened\s*:/);
    // ...and checkEmailOutcomes keeps its opened early-return guard.
    expect(code).toMatch(/eventType === "opened"\)\s*return/);
  });
});
