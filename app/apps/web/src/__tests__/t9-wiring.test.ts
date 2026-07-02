import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T9 (outreach-autopilot) — drift guards. Static assertions that
 * (a) the weekly insight loop stays wired end to end: cron registered,
 *     M12-R5 deliverability cross-check + deterministic LLM fallback in the
 *     cron, schema exported, migration present;
 * (b) the injection seam stays closed: traced-ai fetches the insight block
 *     alongside the other learned getters, and the campaign decision engine
 *     is a drafting agent.
 *
 * Guards the CODE, not the prose (the T2/T7 lesson): comment lines are
 * stripped before assertions that could match documentation. Kept OUT of
 * cle13-wiring.test.ts on purpose (T9 owns its own guard file).
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Drop `//` and `*` comment lines so a doc comment can't satisfy a check. */
const codeOf = (rel: string) =>
  read(rel)
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

describe("T9 wiring — injection seam (traced-ai)", () => {
  it("applyLearnedContext fetches the decision-insight block with the other learned getters", () => {
    const code = codeOf("lib/ai/traced-ai.ts");
    expect(code).toMatch(
      /from\s+["']\.\.\/decision-insights\/get-decision-insights["']/,
    );
    // Fail-soft inside the Promise.all, same contract as the other four.
    expect(code).toContain('getDecisionInsightsPromptBlock(tenantId).catch(() => "")');
    // The fetched block is actually appended, not just fetched.
    expect(code).toMatch(/winloss,\s*insights\]/);
  });

  it("DRAFTING_AGENT_IDS contains the campaign decision engine's agent id", () => {
    const code = codeOf("lib/ai/traced-ai.ts");
    const start = code.indexOf("DRAFTING_AGENT_IDS = new Set([");
    expect(start).toBeGreaterThan(-1);
    const block = code.slice(start, code.indexOf("])", start));
    expect(block).toContain('"decision-engine"');
    // And that id is the one the engine actually traces with.
    const engine = codeOf("inngest/campaign-decision-engine.ts");
    expect(engine).toContain('agentId: "decision-engine"');
  });
});

describe("T9 wiring — the weekly cron", () => {
  it("cross-checks deliverability at publication (M12-R5) with the exact invalidation marker", () => {
    const code = codeOf("inngest/decision-insights-weekly.ts");
    expect(code).toContain("guardTrippedForTenant");
    expect(code).toContain('"deliverability_guard_tripped"');
    // Only POSITIVE lift invalidates — the sign check must survive.
    expect(code).toMatch(/guardTripped\s*&&\s*p\.lift\s*>\s*0/);
  });

  it("keeps the deterministic fallback: templates are set BEFORE the traced Sonnet call, which is caught", () => {
    const code = codeOf("inngest/decision-insights-weekly.ts");
    expect(code).toContain('agentId: "decision-insights-synthesizer"');
    // The traced call sits inside a try whose catch leaves the templates.
    expect(code).toMatch(/try\s*\{[\s\S]{0,1500}?tracedGenerateObject\([\s\S]{0,2000}?\}\s*catch/);
    // The template summaries exist independently of the model.
    expect(code).toContain("patternTemplate");
    expect(code).toContain("antiPatternTemplate");
    expect(code).toContain("coldStartTemplate");
  });

  it("excludes system reviews from the anti-pattern source and reuses the shared classifier", () => {
    const code = codeOf("inngest/decision-insights-weekly.ts");
    expect(code).toMatch(/from\s+["']@\/lib\/sequence-drafts\/rejection-classifier["']/);
    expect(code).toContain('reviewedBy !== "system"');
    expect(code).toContain("dominantInsight");
  });

  it("runs weekly on Monday 06:00 UTC with the delete-then-insert idempotency rule", () => {
    const code = codeOf("inngest/decision-insights-weekly.ts");
    expect(code).toContain('cron: "0 6 * * 1"');
    expect(code).toMatch(/\.delete\(weeklyDecisionInsights\)/);
  });

  it("bounds the LLM spend and never trusts a rephrase that dropped the numbers", () => {
    const code = codeOf("inngest/decision-insights-weekly.ts");
    // Cost-audit rule: cron LLM calls cap their output and their workload.
    expect(code).toContain("maxOutputTokens");
    expect(code).toContain("PHRASE_CAP");
    // The digit guard: a hallucinated n/lift never reaches a drafting prompt.
    expect(code).toContain("rephraseKeepsNumbers");
  });
});

describe("T9 wiring — the injection getter (M12-R5 end-to-end)", () => {
  it("resolves the latest week WITHOUT a status filter, then keeps published rows of THAT week only", () => {
    const code = codeOf("lib/decision-insights/get-decision-insights.ts");
    // Two-step read: a fully-invalidated latest week must yield "" — the
    // single-query fallback re-injected an OLDER published week, defeating
    // the deliverability invalidation in its most common case.
    expect(code).toContain("eq(weeklyDecisionInsights.weekOf, latest.weekOf)");
    // Deterministic within-week ordering (a weekly batch shares one created_at).
    expect(code).toMatch(/abs\(.*lift.*\)\s*DESC NULLS LAST/i);
  });
});

describe("T9 wiring — registry, schema, migration", () => {
  it("the inngest registry serves decisionInsightsWeekly", () => {
    const code = codeOf("app/api/inngest/route.ts");
    expect(code).toMatch(
      /from\s+["']@\/inngest\/decision-insights-weekly["']/,
    );
    // Present in the functions array (as a bare list entry).
    expect(code).toMatch(/\n\s*decisionInsightsWeekly,/);
  });

  it("the schema barrel exports the insights table", () => {
    const code = codeOf("db/schema.ts");
    expect(code).toContain('export * from "./schema/decision-insights"');
  });

  it("migration 0115 creates the table with the soft-reference contract (no FK)", () => {
    const sql = readFileSync(
      join(ROOT, "..", "drizzle", "0115_weekly_decision_insights.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS weekly_decision_insights");
    expect(sql).not.toContain("REFERENCES");
    expect(sql).toContain("weekly_decision_insights_tenant_week_idx");
    expect(sql).toContain("weekly_decision_insights_tenant_status_idx");
  });

  it("the getter excludes cold_start and non-published rows in SQL", () => {
    const code = codeOf("lib/decision-insights/get-decision-insights.ts");
    expect(code).toContain('eq(weeklyDecisionInsights.status, "published")');
    expect(code).toContain('ne(weeklyDecisionInsights.kind, "cold_start")');
  });
});
