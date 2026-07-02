import { getAuthContext } from "@/lib/auth/auth-utils";
import { checkRateLimit } from "@/lib/infra/rate-limit";
import { anthropic } from "@/lib/ai/ai-provider";
import { openai } from "@ai-sdk/openai";
import { tracedGenerateObject } from "@/lib/ai/traced-ai";
import { loadReplyKnowledgeBlock, knowledgeSection } from "@/lib/inbox/reply-knowledge";
import { loadAccountBriefForContact } from "@/lib/inbox/reply-instructions";
import { buildSuggestReplyPrompt } from "@/lib/inbox/suggest-reply-prompt";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const suggestReplySchema = z.object({
  replies: z.array(
    z.object({
      tone: z.string().describe("The tone of the reply: 'brief', 'detailed', or 'decline'"),
      subject: z.string().describe("Reply email subject line"),
      body: z.string().describe("Reply email body"),
    })
  ).describe("2-3 reply options with different tones"),
});

export async function POST(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlResponse = await checkRateLimit("llm", authCtx.userId);
  if (rlResponse) return rlResponse;

  const model = process.env.ANTHROPIC_API_KEY
    ? anthropic("claude-sonnet-4-6")
    : process.env.OPENAI_API_KEY
      ? openai("gpt-4o-mini")
      : null;

  if (!model) {
    return Response.json({ error: "No LLM API key configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { emailContent, senderName, senderEmail } = body;

    if (!emailContent || typeof emailContent !== "string") {
      return Response.json({ error: "emailContent required" }, { status: 400 });
    }

    // Product facts the replies may cite (pricing/capabilities/objections). Empty
    // until the tenant seeds a KB — then the replies can ANSWER pricing questions
    // instead of inventing figures. Paired with the anti-fabrication rule in the
    // prompt builder.
    const knowledge = knowledgeSection(await loadReplyKnowledgeBlock(authCtx.tenantId));

    // Account grounding (open objections, deal stage, signals) — the same brief
    // composeReply gets. This route only receives a sender email, so resolve the
    // contact by address; no match → "" and the prompt is byte-identical to the
    // ungrounded one. Fail-soft: grounding must never break a suggestion.
    const accountBrief = await (async () => {
      if (!senderEmail || typeof senderEmail !== "string") return "";
      try {
        const [contact] = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, authCtx.tenantId),
              sql`lower(${contacts.email}) = ${senderEmail.toLowerCase()}`,
              isNull(contacts.deletedAt),
            ),
          )
          .limit(1);
        return contact ? await loadAccountBriefForContact(authCtx.tenantId, contact.id) : "";
      } catch {
        return "";
      }
    })();

    const prompt = buildSuggestReplyPrompt({
      emailContent,
      senderName,
      senderEmail,
      knowledge,
      accountBrief,
    });

    const { object } = await tracedGenerateObject({
      model,
      schema: suggestReplySchema,
      prompt,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
      _trace: { agentId: "suggest-reply", tenantId: authCtx.tenantId },
    });
    const result = object as any;

    return Response.json({ replies: result.replies });
  } catch (error) {
    console.error("Reply suggestion failed:", error);
    return Response.json({ error: "Reply suggestion failed" }, { status: 500 });
  }
}
