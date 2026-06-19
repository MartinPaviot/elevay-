/**
 * Ask-inbox agent (B5) — the bounded retrieve → verify → act loop.
 *
 * Reuses the AI-SDK tool loop (generateText + tools + stopWhen: stepCountIs) via
 * tracedGenerateText — NOT a hand-rolled while-loop — so stop conditions, tracing
 * and step accounting come for free (mirrors api/chat/route.ts:744). The model
 * searches/reads the SCOPED corpus through the tools, then emits a final JSON
 * answer; verifyAnswer re-validates every citation against the evidence the tools
 * actually returned and collapses to abstention when nothing grounds it.
 *
 * Read-only: there is no send/book/label tool in the loop. Fail-closed: any error
 * → an honest "not found". The model is injectable for offline testing.
 */

import { stepCountIs, type LanguageModel } from "ai";
import { anthropic } from "@/lib/ai/ai-provider";
import { tracedGenerateText } from "@/lib/ai/traced-ai";
import { buildAskAgentTools, newSeenLedger, type AgentCorpus } from "@/lib/inbox/ask-agent-tools";
import { verifyAnswer, NOT_FOUND_ANSWER, type AgentAnswer } from "@/lib/inbox/ask-agent-verify";

export const AGENT_SYSTEM = `You are an inbox research agent. Answer the user's question using ONLY their inbox.
- Use search_inbox to find relevant threads, then read_thread or summarize_thread to confirm the facts.
- Ground every claim in a thread you actually retrieved. NEVER invent threads, keys, or facts.
- If the inbox does not contain the answer, abstain — do not guess.
On your FINAL step call NO tool and reply with ONLY this JSON, nothing else:
{"answer": string, "answered": boolean, "citations": [{"key": string, "messageIdx": number}]}
messageIdx is optional. Set answered=false with empty citations when you cannot ground an answer.`;

export interface RunInboxAgentOpts {
  tenantId: string;
  /** Injectable for tests; defaults to Anthropic Haiku. */
  model?: LanguageModel;
  maxSteps?: number;
  /** Standing instructions / memory prompt prepended to the system prompt. */
  instructions?: string;
}

const MAX_STEPS = 6;

function parseAgentJson(text: string): { answer?: unknown; answered?: unknown; citations?: unknown } {
  try {
    const m = (text || "").match(/\{[\s\S]*\}/);
    if (!m) return { answered: false };
    return JSON.parse(m[0]) as { answer?: unknown; answered?: unknown; citations?: unknown };
  } catch {
    return { answered: false };
  }
}

export async function runInboxAgent(
  corpus: AgentCorpus,
  question: string,
  opts: RunInboxAgentOpts,
): Promise<AgentAnswer> {
  const model = opts.model ?? anthropic("claude-haiku-4-5-20251001");
  const seen = newSeenLedger();
  try {
    const result = await tracedGenerateText({
      model,
      system: AGENT_SYSTEM + (opts.instructions ? `\n\n${opts.instructions}` : ""),
      messages: [{ role: "user", content: question }],
      tools: buildAskAgentTools(corpus, seen),
      stopWhen: stepCountIs(opts.maxSteps ?? MAX_STEPS),
      _trace: { agentId: "inbox-ask-agent", tenantId: opts.tenantId, inputPreview: question.slice(0, 200) },
    });
    const raw = parseAgentJson(result.text ?? "");
    return verifyAnswer(raw, { keysSeen: seen.keys, threadMsgCount: seen.msgCount, subjects: seen.subjects });
  } catch {
    return { answer: NOT_FOUND_ANSWER, answered: false, citations: [] };
  }
}
