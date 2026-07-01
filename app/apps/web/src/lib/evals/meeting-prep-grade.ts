/**
 * Deterministic grounding grader for the meeting-prep eval.
 *
 * The prep prompt instructs "Ground everything in the data above; never invent a
 * fact (write 'unknown')" — but nothing MEASURES whether the model obeys. This
 * grader reuses the proven, pure `extractHardSpecifics` (fabrication-gate.ts) to
 * find the hard specifics (counts ≥100, named third-party tools, ALLCAPS+year
 * events) the prep asserts that are ABSENT from its grounding context — i.e. the
 * model invented them. Deterministic + free; the LLM tier only produces the prep.
 */

import { extractHardSpecifics } from "./fabrication-gate";

const normNum = (s: string): string => s.replace(/\D/g, "");

/**
 * Hard specifics the prep asserts that are NOT grounded in `context`. Mirrors
 * decideFabricationGate's deterministic layer, but the ground truth is the prep's
 * OWN context brief (the only facts it was given) instead of a research brief.
 */
export function ungroundedInPrep(prep: string, context: string): string[] {
  const gt = context.toLowerCase();
  const gtDigits = normNum(gt);
  const { numbers, techTokens, events } = extractHardSpecifics(prep);
  const out = new Set<string>();
  for (const n of numbers) {
    const d = normNum(n);
    if (d && !gtDigits.includes(d)) out.add(n);
  }
  for (const t of techTokens) if (!gt.includes(t)) out.add(t);
  for (const e of events) if (!gt.includes(e.toLowerCase())) out.add(e);
  return [...out];
}

export interface MeetingPrepGrade {
  pass: boolean;
  ungrounded: string[];
}

/** Pass when the prep invents no hard specific absent from its grounding context. */
export function gradeMeetingPrepGrounding(prep: string, context: string): MeetingPrepGrade {
  const ungrounded = ungroundedInPrep(prep, context);
  return { pass: ungrounded.length === 0, ungrounded };
}
