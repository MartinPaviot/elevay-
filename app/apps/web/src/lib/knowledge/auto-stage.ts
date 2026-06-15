/**
 * Auto-stage classification — the "write normally" contract: the user
 * types a title and a text, and the entry routes ITSELF to the product
 * moments it serves (lib/knowledge/stages.ts). One small constrained LLM
 * step, validated verbatim against the stage taxonomy, fail-soft to the
 * category/title derivation — never a blocker, never an invented stage.
 * The stage chips in Settings → Knowledge stay as optional refinement.
 */

import { z } from "zod";
import { tracedGenerateObject } from "@/lib/ai/traced-ai";
import { anthropic } from "@/lib/ai/ai-provider";
import { openai } from "@ai-sdk/openai";
import {
  KNOWLEDGE_STAGES,
  deriveDefaultStages,
  sanitizeStages,
  type KnowledgeStage,
} from "./stages";

export async function classifyStages(
  title: string,
  content: string,
  tenantId: string,
  category = "custom",
): Promise<KnowledgeStage[]> {
  const fallback = () => deriveDefaultStages(category, title);
  const model = process.env.ANTHROPIC_API_KEY
    ? anthropic("claude-haiku-4-5-20251001")
    : process.env.OPENAI_API_KEY
      ? openai("gpt-4o-mini")
      : null;
  if (!model || !content.trim()) return fallback();

  try {
    const { object } = await tracedGenerateObject({
      model,
      schema: z.object({
        stages: z
          .array(z.string())
          .min(1)
          .max(3)
          .describe("Stage keys copied verbatim from the list, the moments this knowledge actually serves"),
      }),
      prompt: `A user wrote a knowledge-base entry for their sales workspace. Route it to the product moment(s) it serves.

STAGES (the only allowed outputs — copy keys verbatim):
${KNOWLEDGE_STAGES.map((s) => `- ${s.key}: ${s.description}`).join("\n")}

ENTRY TITLE: ${title.slice(0, 200)}
ENTRY CONTENT:
${content.slice(0, 2500)}

Pick 1-3 stages. "global" is for company identity/context wanted everywhere — prefer a specific stage when the content clearly serves one moment (e.g. objection responses -> objections; call scripts/openers -> cold_call; who to target -> sourcing; email wording -> outreach; pricing/proposal facts -> meetings).`,
      _trace: {
        agentId: "knowledge-auto-stage",
        tenantId,
        inputPreview: title.slice(0, 120),
      },
    });
    const clean = sanitizeStages((object as { stages: string[] }).stages);
    return clean.length > 0 ? clean : fallback();
  } catch {
    return fallback();
  }
}
