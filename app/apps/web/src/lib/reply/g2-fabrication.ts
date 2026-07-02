/**
 * M13 T6b — G2 (factual) gate for LLM-generated REPLY bodies, shared by every
 * reply-generation seam (inngest/reply-handler positive + objection,
 * inngest/reply-agent delegated classifications). Reply paths can AUTO-SEND,
 * so a fabricated specific here reaches a real prospect with no human in
 * between.
 *
 * The semantic judge (1 Haiku call, ANTHROPIC_API_KEY-guarded, fail-open)
 * feeds the deterministic gate; if blocked, ONE corrective regeneration, then
 * the DETERMINISTIC layer alone re-checks (no second judge call — bounded
 * cost, design §5). A failed roll keeps the ORIGINAL body with verdict
 * "blocked" rather than re-checking the unchanged body: a semantic-only block
 * would false-pass the deterministic recheck. A gate infrastructure failure
 * fails CLOSED ("blocked") — callers must map "blocked" to draft-only status,
 * never queued.
 */

import { z } from "zod";
import { tracedGenerateObject } from "@/lib/ai/traced-ai";
import { decideFabricationGate, judgeFabrication } from "@/lib/evals/fabrication-gate";
import type { ResearchBriefContext } from "@/lib/context/prospect-context";

export const replyEmailSchema = z.object({
  subject: z.string().describe("Reply subject (usually Re: original subject)"),
  body: z.string().describe("Reply body — professional, contextual, concise"),
});

export interface G2GatedReply {
  subject: string;
  body: string;
  verdict: "pass" | "reworked" | "blocked";
  ungrounded: string[];
  briefHasFacts: boolean;
  failClosed?: "gate_error";
}

export async function applyG2FabricationGate(args: {
  reply: { subject: string; body: string };
  // ProspectContext after step.run serialization — only the fields the gate reads.
  ctx: {
    contact?: { fullName?: string | null; title?: string | null } | null;
    company?: { name?: string | null; domain?: string | null } | null;
    researchBrief?: ResearchBriefContext;
  };
  model: unknown;
  basePrompt: string;
  trace: { tenantId: string; contactId: string; companyId?: string; inputPreview: string };
}): Promise<G2GatedReply> {
  const { reply, ctx, basePrompt } = args;
  const prospect = {
    name: ctx.contact?.fullName ?? null,
    title: ctx.contact?.title ?? null,
    company: ctx.company?.name ?? null,
    domain: ctx.company?.domain ?? null,
  };
  try {
    let claims: Awaited<ReturnType<typeof judgeFabrication>> = [];
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        claims = await judgeFabrication(reply.body, ctx.researchBrief, prospect);
      } catch {
        claims = []; // judge is advisory — the deterministic layer still enforces
      }
    }
    const fab = decideFabricationGate({
      body: reply.body,
      brief: ctx.researchBrief,
      prospect,
      semanticClaims: claims,
    });
    if (!fab.blocked) {
      return { subject: reply.subject, body: reply.body, verdict: "pass", ungrounded: [], briefHasFacts: fab.briefHasFacts };
    }
    let corrected: { subject: string; body: string };
    try {
      const { object } = await tracedGenerateObject({
        model: args.model,
        schema: replyEmailSchema,
        prompt: `${basePrompt}\n\nPREVIOUS ATTEMPT FEEDBACK — fix these issues:\nCRITICAL — these specifics are NOT supported by the research and read as fabricated. Remove them or replace with a verified fact, and do NOT invent any new prospect-specific fact: ${fab.ungrounded.slice(0, 8).join("; ")}.`,
        _trace: { agentId: "follow-up-email", ...args.trace },
      });
      corrected = object as { subject: string; body: string };
    } catch {
      // Corrective regeneration failed — the blocked original must stay draft-only.
      return { subject: reply.subject, body: reply.body, verdict: "blocked", ungrounded: fab.ungrounded.slice(0, 8), briefHasFacts: fab.briefHasFacts };
    }
    const recheck = decideFabricationGate({ body: corrected.body, brief: ctx.researchBrief, prospect });
    if (recheck.blocked) {
      return { subject: corrected.subject, body: corrected.body, verdict: "blocked", ungrounded: recheck.ungrounded.slice(0, 8), briefHasFacts: recheck.briefHasFacts };
    }
    return { subject: corrected.subject, body: corrected.body, verdict: "reworked", ungrounded: fab.ungrounded.slice(0, 8), briefHasFacts: fab.briefHasFacts };
  } catch {
    // Gate infrastructure failure: an auto-send must never happen ungated.
    return { subject: reply.subject, body: reply.body, verdict: "blocked", ungrounded: [], briefHasFacts: false, failClosed: "gate_error" };
  }
}
