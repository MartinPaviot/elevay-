/**
 * The single LLM step of the engine — and the only place a model touches the
 * spoken script. It phrases (a) a commercial insight/reframe and (b) one Tier-1
 * problem scene, FROM the grounded evidence, in the tenant register.
 *
 * The guarantee that this is "intelligence, not a prompt": the call is
 * schema-constrained AND every produced claim must cite the evidence id it used
 * — any claim whose `evidenceRef` is not one of the supplied ids is DROPPED
 * (fail-closed). No model key or no insight inputs ⇒ no call (the assembler
 * falls back to the template stub). Model + generate are injected so this
 * unit-tests without a network round-trip (mirrors coaching-classifier.ts).
 */

import { z } from "zod";
import { generateObject } from "ai";
import type { GroundedClaim, ProspectEvidence, ScriptTemplate } from "./types";

export interface GroundedInsightDeps {
  /** Inject `anthropic("claude-haiku-4-5-20251001")` in production; a mock in tests. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
  /** Override generateObject for tests. */
  generate?: typeof generateObject;
}

export interface GroundedInsightResult {
  insight: GroundedClaim | null;
  problemScene: GroundedClaim | null;
}

const schema = z.object({
  insight: z.object({ text: z.string(), evidenceRef: z.string() }).nullable(),
  problemScene: z.object({ text: z.string(), evidenceRef: z.string() }).nullable(),
});

const SYSTEM_PROMPT = `You phrase a cold-call commercial insight and ONE Tier-1 problem scene from grounded evidence, for a salesperson booking a 45-min meeting.

Hard rules:
- Reference ONLY facts present in EVIDENCE. Do not invent companies, numbers, triggers, or claims.
- For each output set evidenceRef to the EVIDENCE id (e.g. "E1") you used.
- If you cannot ground a field in EVIDENCE, return null for that field.
- One reframe (insight) + one vivid, specific problem scene (problemScene). Not three.
- Use "vous". No vendor pitch, no product feature dump, no superlatives.`;

/** Keep a claim only if it is non-empty AND cites a real evidence id. */
function validRef(claim: GroundedClaim | null | undefined, ids: Set<string>): GroundedClaim | null {
  if (!claim || typeof claim.text !== "string" || !claim.text.trim()) return null;
  if (!ids.has(claim.evidenceRef)) return null;
  return { text: claim.text.trim(), evidenceRef: claim.evidenceRef };
}

export async function generateGroundedInsight(
  evidence: ProspectEvidence,
  template: ScriptTemplate,
  deps: GroundedInsightDeps,
): Promise<GroundedInsightResult> {
  if (!deps.model || evidence.insightInputs.length === 0) {
    return { insight: null, problemScene: null };
  }
  const ids = new Set(evidence.insightInputs.map((e) => e.id));
  const evidenceBlock = evidence.insightInputs.map((e) => `${e.id}: ${e.value}`).join("\n");
  const generate = deps.generate ?? generateObject;

  try {
    const { object } = await generate({
      model: deps.model,
      schema,
      system: SYSTEM_PROMPT,
      prompt: `PRODUCT/REGISTER: ${template.product?.trim() || "(non renseigné)"}
SECTOR: ${evidence.sector || "(générique)"}${evidence.persona.title ? `\nPERSONA: ${evidence.persona.title}` : ""}

EVIDENCE (cite these ids):
${evidenceBlock}

Return { insight, problemScene } grounded in the EVIDENCE ids above.`,
    });
    const out = object as GroundedInsightResult;
    // Fail-closed: drop any claim that doesn't cite a real evidence id.
    return { insight: validRef(out.insight, ids), problemScene: validRef(out.problemScene, ids) };
  } catch {
    // A missed insight must never crash assembly — the stub takes over.
    return { insight: null, problemScene: null };
  }
}
