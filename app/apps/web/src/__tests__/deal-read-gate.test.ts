/**
 * Deal-READ gate — does the AI's read of a deal match the correct STRATEGIC read?
 *
 * The schema-only suite (lib/evals/suites/deal-briefing.eval.ts) deferred the
 * "LLM-grounded golden" eval as a separate cycle. This is that cycle. 6 synthetic
 * scenarios probe the hard part: a warm tone hiding a stall, a buried objection,
 * a silent ghost, an explicit churn. Each has a DESIGNED golden read.
 *
 * KEYLESS floor (always, CI): the fixtures are sound — every mustCatch signal is
 * grounded verbatim in its timeline.
 * LLM tier (skipIf no key): run the EXACT prod deal-briefing prompt (reused via
 * the extracted seam) through generateObject, then grade the structured output
 * DETERMINISTICALLY (right risk, stall flagged, signal caught, nothing invented).
 * Wired into eval:run; runs locally / in a keyed cron, skips in keyless CI.
 */

import { describe, it, expect } from "vitest";
import { DEAL_READ_SCENARIOS } from "@/lib/evals/deal-read-cases";
import {
  gradeDealRead,
  timelineGroundsGolden,
  type DealBriefBody,
} from "@/lib/evals/deal-read-grade";
import {
  buildDealBriefPrompt,
  formatDealTimeline,
  getDealBriefModel,
} from "@/lib/deals/deal-briefing-prompt";
import { dealBriefSchema } from "@/lib/deals/deal-briefing-schema";

const HAS_LLM = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;

const BODY_SCHEMA = dealBriefSchema.omit({
  dealId: true,
  dealName: true,
  stage: true,
  value: true,
  contactName: true,
  companyName: true,
  daysInStage: true,
});

describe("deal-read fixtures are sound (keyless)", () => {
  it("every scenario's mustCatch signal is grounded verbatim in its timeline", () => {
    const broken = DEAL_READ_SCENARIOS.filter((s) => !timelineGroundsGolden(s).ok);
    expect(broken.map((s) => s.id)).toEqual([]);
  });
});

describe.skipIf(!HAS_LLM)("deal-read — the AI read matches the designed strategic read", () => {
  it(
    "passes ≥5/6 scenarios (right risk, stall flagged, signal caught, no fabrication)",
    async () => {
      const { generateObject } = await import("ai");
      const model = getDealBriefModel();
      if (!model) return;

      let passed = 0;
      const detail: string[] = [];
      for (const s of DEAL_READ_SCENARIOS) {
        const prompt = buildDealBriefPrompt({
          dealName: s.deal.name,
          stage: s.deal.stage,
          value: s.deal.value,
          companyName: s.companyName,
          contactName: s.contactName,
          contactTitle: s.contactTitle,
          daysInStage: s.deal.daysInStage,
          stallBucket: s.deal.stallBucket,
          dealSummary: s.deal.summary,
          activityCount: s.activities.length,
          timeline: formatDealTimeline(s.activities),
          graphSection: "None extracted",
          signalSection: "None extracted",
        });

        let body: DealBriefBody;
        try {
          const res = await generateObject({
            model: model as unknown as Parameters<typeof generateObject>[0]["model"],
            schema: BODY_SCHEMA,
            prompt,
          });
          body = res.object as DealBriefBody;
        } catch (e) {
          detail.push(`${s.id}: generate error ${(e as Error).message}`);
          continue;
        }

        const grade = gradeDealRead(body, s.golden);
        if (grade.pass) passed++;
        else detail.push(`${s.id}: ${grade.failures.join("; ")} [risk=${body.riskLevel}]`);
      }

      // eslint-disable-next-line no-console
      console.log(
        `[deal-read] passed ${passed}/${DEAL_READ_SCENARIOS.length}` +
          (detail.length ? ` — ${detail.join(" | ")}` : " (all correct)"),
      );
      expect(passed, detail.join(" | ")).toBeGreaterThanOrEqual(5);
    },
    180_000,
  );
});
