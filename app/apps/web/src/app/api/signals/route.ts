import { auth } from "@/auth";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const signalSchema = z.object({
  signals: z.array(
    z.object({
      type: z.enum(["hiring", "funding", "tech_change", "news", "expansion", "leadership_change"]),
      title: z.string().describe("Short signal title"),
      description: z.string().describe("1-2 sentence description of the signal"),
      relevance: z.enum(["high", "medium", "low"]),
      reasoning: z.string().describe("Detailed explanation of WHY this signal matters for sales outreach — what it implies about their buying intent or timing"),
      sources: z.array(
        z.object({
          url: z.string().describe("URL where this information can be verified (company website, news article, job board, LinkedIn)"),
          title: z.string().describe("Title of the source page"),
        })
      ).describe("1-3 sources where this signal can be verified"),
    })
  ),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const model = process.env.ANTHROPIC_API_KEY
    ? anthropic("claude-sonnet-4-20250514")
    : process.env.OPENAI_API_KEY
      ? openai("gpt-4o-mini")
      : null;

  if (!model) {
    return Response.json({ error: "No LLM API key configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { companyIds } = body;

    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return Response.json({ error: "companyIds array required" }, { status: 400 });
    }

    let detected = 0;
    let totalSignals = 0;

    for (const id of companyIds.slice(0, 20)) {
      try {
        const [company] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, id))
          .limit(1);

        if (!company) continue;

        const { object } = await generateObject({
          model,
          schema: signalSchema,
          prompt: `Analyze this company for buying signals. Generate realistic signals based on what you know about the company.

Company: ${company.name}
Domain: ${company.domain || "unknown"}
Industry: ${company.industry || "unknown"}
Size: ${company.size || "unknown"}
Revenue: ${company.revenue || "unknown"}
Description: ${company.description || "none"}

Signal types to look for:
- hiring: Active job postings in relevant areas (engineering, sales, product)
- funding: Recent funding rounds, acquisitions, or financial events
- tech_change: Technology stack changes, migrations, new tool adoption
- news: Company news, product launches, partnerships
- expansion: New offices, market expansion, international growth
- leadership_change: New C-suite hires, board changes

For each signal, provide:
1. A detailed "reasoning" explaining WHY this signal matters for sales — what it implies about buying intent, budget availability, or timing
2. 1-3 "sources" with realistic URLs where this information could be verified (use the company domain, LinkedIn, Crunchbase, TechCrunch, etc.)

Only include signals you're reasonably confident about. Return an empty array if no clear signals.`,
        });

        const props = (company.properties || {}) as Record<string, unknown>;
        await db
          .update(companies)
          .set({
            properties: {
              ...props,
              signals: object.signals.map((s) => ({
                ...s,
                detectedAt: new Date().toISOString(),
              })),
            },
            updatedAt: new Date(),
          })
          .where(eq(companies.id, id));

        if (object.signals.length > 0) detected++;
        totalSignals += object.signals.length;
      } catch (err) {
        console.warn(`Failed to detect signals for company ${id}:`, err);
      }
    }

    return Response.json({ success: true, detected, totalSignals });
  } catch (error) {
    console.error("Signal detection failed:", error);
    return Response.json({ error: "Signal detection failed" }, { status: 500 });
  }
}
