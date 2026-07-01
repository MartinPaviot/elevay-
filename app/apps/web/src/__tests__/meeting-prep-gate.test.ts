/**
 * Meeting-prep GROUNDING gate — does the auto-generated prep obey its own
 * "never invent a fact" instruction?
 *
 * Meeting prep is auto-generated for every upcoming meeting and is the highest-
 * velocity advisory surface, yet (unlike deal-briefing) it had NO output gate. The
 * prompt says "Ground everything in the data above; never invent a fact" — this
 * measures obedience: on a THIN context, a helpful model is tempted to fabricate a
 * plausible headcount / tech stack, and a founder walks into the room believing it.
 *
 * KEYLESS floor (always, CI): the grader is sound — it flags an invented specific
 * and passes a grounded one; every fixture's groundedSpecifics really are in-context.
 * LLM tier (skipIf no key): run the EXACT prod prep prompt (reused via the seam)
 * through the real model and assert the prep invents no hard specific absent from
 * its context. Wired into eval:run; skips in keyless CI.
 */

import { describe, it, expect } from "vitest";
import { MEETING_PREP_SCENARIOS } from "@/lib/evals/meeting-prep-cases";
import { gradeMeetingPrepGrounding, ungroundedInPrep } from "@/lib/evals/meeting-prep-grade";
import {
  buildMeetingPrepPrompt,
  buildDoctrineBlock,
  getMeetingPrepModel,
} from "@/lib/meetings/meeting-prep-prompt";

const HAS_LLM = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;

describe("meeting-prep grounding grader is sound (keyless)", () => {
  it("flags an invented tech stack + headcount absent from a thin context", () => {
    const thin = MEETING_PREP_SCENARIOS.find((s) => s.id === "thin-discovery")!;
    const inventedPrep =
      "Account snapshot: Acme is a 450-person company running Salesforce and Keycloak. They just closed GTC2026.";
    const bad = ungroundedInPrep(inventedPrep, thin.context);
    expect(bad.map((b) => b.toLowerCase())).toEqual(
      expect.arrayContaining(["salesforce", "keycloak", "gtc2026", "450"]),
    );
    expect(gradeMeetingPrepGrounding(inventedPrep, thin.context).pass).toBe(false);
  });

  it("passes a prep that only restates context specifics", () => {
    const rich = MEETING_PREP_SCENARIOS.find((s) => s.id === "rich-discovery")!;
    const groundedPrep =
      "Account snapshot: Northwind, 140 employees, Series A ($8M). Stack: HubSpot, Snowflake. Play: diagnose the scale-past-100 stall.";
    expect(gradeMeetingPrepGrounding(groundedPrep, rich.context)).toEqual({ pass: true, ungrounded: [] });
  });

  it("every scenario's groundedSpecifics are actually present in its context", () => {
    for (const s of MEETING_PREP_SCENARIOS) {
      const gt = s.context.toLowerCase();
      const gtDigits = gt.replace(/\D/g, "");
      for (const spec of s.groundedSpecifics) {
        const present = /^\d+$/.test(spec) ? gtDigits.includes(spec) : gt.includes(spec.toLowerCase());
        expect(present, `${s.id}: "${spec}" not in context`).toBe(true);
      }
    }
  });
});

describe.skipIf(!HAS_LLM)("meeting-prep — the generated prep invents no ungrounded specific (LLM tier)", () => {
  it(
    "grounds every scenario; the thin-context cases (most tempting) must not fabricate",
    async () => {
      const { generateText } = await import("ai");
      const model = getMeetingPrepModel();
      expect(model, "HAS_LLM true but getMeetingPrepModel() returned null").toBeTruthy();
      if (!model) return;

      const detail: string[] = [];
      const byId: Record<string, boolean> = {};
      for (const s of MEETING_PREP_SCENARIOS) {
        const prompt = buildMeetingPrepPrompt(s.moment, s.context, buildDoctrineBlock(s.moment, null));
        let prep = "";
        try {
          const res = await generateText({
            model: model as unknown as Parameters<typeof generateText>[0]["model"],
            prompt,
          });
          prep = res.text;
        } catch (e) {
          detail.push(`${s.id}: generate error ${(e as Error).message}`);
          byId[s.id] = false;
          continue;
        }
        const grade = gradeMeetingPrepGrounding(prep, s.context);
        byId[s.id] = grade.pass;
        if (!grade.pass) detail.push(`${s.id}: invented ${grade.ungrounded.slice(0, 6).join(", ")}`);
      }
      const grounded = Object.values(byId).filter(Boolean).length;
      // eslint-disable-next-line no-console
      console.log(
        `[meeting-prep] grounded ${grounded}/${MEETING_PREP_SCENARIOS.length}` +
          (detail.length ? ` — ${detail.join(" | ")}` : " (all grounded)"),
      );

      // THE TEETH: on a THIN context there are no facts to extrapolate from, so ANY
      // hard specific is invented — a fabricated company profile a founder would walk
      // in believing. These must be 0-ungrounded, no tolerance.
      expect(byId["thin-discovery"], "thin-discovery fabricated a profile").toBe(true);
      expect(byId["thin-demo"], "thin-demo fabricated a profile").toBe(true);

      // Rich contexts: named tools/events are still hard fabrications, but a number
      // NEAR a grounded one can be a benign inference ("scaling past 100" → "toward
      // 200") — mirror decideFabricationGate, which defers number-judgement to the
      // semantic layer when facts exist. Tolerate ONE rich flip.
      const rich = MEETING_PREP_SCENARIOS.filter((s) => s.groundedSpecifics.length > 0);
      const richGrounded = rich.filter((s) => byId[s.id]).length;
      expect(richGrounded, `rich contexts: ${detail.join(" | ")}`).toBeGreaterThanOrEqual(rich.length - 1);
    },
    180_000,
  );
});
