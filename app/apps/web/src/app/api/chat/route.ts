import { getAuthContext } from "@/lib/auth-utils";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from "ai";
import { searchSimilar } from "@/lib/embeddings";
import { db } from "@/db";
import { companies, contacts, deals, activities, notes } from "@/db/schema";
import { and, eq, desc, sql, ilike, or } from "drizzle-orm";
import { z } from "zod";
// JSONValue type for tool generics
type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

export const maxDuration = 60;

/** Build a snapshot of the tenant's CRM data for the system prompt */
async function getCRMSnapshot(tenantId: string): Promise<string> {
  const [accountCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(companies)
    .where(eq(companies.tenantId, tenantId));

  const [contactCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(eq(contacts.tenantId, tenantId));

  const [dealCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(deals)
    .where(eq(deals.tenantId, tenantId));

  const [activityCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activities)
    .where(eq(activities.tenantId, tenantId));

  const recentAccounts = await db
    .select({ id: companies.id, name: companies.name, domain: companies.domain, industry: companies.industry, score: companies.score })
    .from(companies)
    .where(eq(companies.tenantId, tenantId))
    .orderBy(desc(companies.createdAt))
    .limit(10);

  const recentContacts = await db
    .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email, title: contacts.title, companyId: contacts.companyId })
    .from(contacts)
    .where(eq(contacts.tenantId, tenantId))
    .orderBy(desc(contacts.createdAt))
    .limit(10);

  const recentDeals = await db
    .select({ id: deals.id, name: deals.name, stage: deals.stage, value: deals.value })
    .from(deals)
    .where(eq(deals.tenantId, tenantId))
    .orderBy(desc(deals.createdAt))
    .limit(10);

  const recentActivities = await db
    .select({
      id: activities.id,
      activityType: activities.activityType,
      summary: activities.summary,
      entityType: activities.entityType,
      entityId: activities.entityId,
      occurredAt: activities.occurredAt,
      direction: activities.direction,
    })
    .from(activities)
    .where(eq(activities.tenantId, tenantId))
    .orderBy(desc(activities.occurredAt))
    .limit(15);

  let snapshot = `\n\n## CRM Data Snapshot
- Accounts: ${accountCount.count}
- Contacts: ${contactCount.count}
- Deals: ${dealCount.count}
- Activities: ${activityCount.count}`;

  if (recentAccounts.length > 0) {
    snapshot += `\n\n### Recent Accounts\n${recentAccounts.map((a) => `- ${a.name} (${a.domain || "no domain"}, ${a.industry || "unknown industry"}, score: ${a.score ?? "unscored"}) [id:${a.id}]`).join("\n")}`;
  }

  if (recentContacts.length > 0) {
    snapshot += `\n\n### Recent Contacts\n${recentContacts.map((c) => `- ${[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed"} <${c.email || "no email"}> ${c.title || ""} [id:${c.id}]`).join("\n")}`;
  }

  if (recentDeals.length > 0) {
    snapshot += `\n\n### Recent Deals\n${recentDeals.map((d) => `- ${d.name} (${d.stage}, $${d.value?.toLocaleString() || "0"}) [id:${d.id}]`).join("\n")}`;
  }

  if (recentActivities.length > 0) {
    snapshot += `\n\n### Recent Activities\n${recentActivities.map((a) => `- ${a.occurredAt?.toISOString().split("T")[0] || "?"} ${a.activityType} ${a.direction || ""}: ${a.summary || "no summary"} [${a.entityType}:${a.entityId}]`).join("\n")}`;
  }

  return snapshot;
}

async function getEntityContext(contextType?: string, contextId?: string, tenantId?: string): Promise<string> {
  if (!contextType || !contextId || !tenantId) return "";
  try {
    if (contextType === "account" || contextType === "company") {
      const [company] = await db.select().from(companies).where(and(eq(companies.id, contextId), eq(companies.tenantId, tenantId))).limit(1);
      if (company) {
        const props = (company.properties || {}) as Record<string, unknown>;
        const companyContacts = await db.select().from(contacts).where(and(eq(contacts.companyId, contextId), eq(contacts.tenantId, tenantId)));
        const companyDeals = await db.select().from(deals).where(and(eq(deals.companyId, contextId), eq(deals.tenantId, tenantId)));
        const companyActivities = await db.select().from(activities).where(and(eq(activities.entityId, contextId), eq(activities.entityType, "company"), eq(activities.tenantId, tenantId))).orderBy(desc(activities.occurredAt)).limit(20);

        let ctx = `\n\n## Current Context: Account "${company.name}"
Domain: ${company.domain || "unknown"}
Industry: ${company.industry || "unknown"}
Size: ${company.size || "unknown"}
Revenue: ${company.revenue || "unknown"}
Score: ${company.score ?? "unscored"}
Description: ${company.description || "none"}`;
        if (props.technologies) ctx += `\nTechnologies: ${JSON.stringify(props.technologies)}`;
        if (props.total_funding_printed) ctx += `\nFunding: ${props.total_funding_printed}`;

        if (companyContacts.length > 0) {
          ctx += `\n\n### Contacts at ${company.name} (${companyContacts.length})\n${companyContacts.map((c) => `- ${[c.firstName, c.lastName].filter(Boolean).join(" ")} <${c.email}> ${c.title || ""}`).join("\n")}`;
        }
        if (companyDeals.length > 0) {
          ctx += `\n\n### Deals with ${company.name}\n${companyDeals.map((d) => `- ${d.name} (${d.stage}, $${d.value?.toLocaleString() || "0"})`).join("\n")}`;
        }
        if (companyActivities.length > 0) {
          ctx += `\n\n### Recent Activity\n${companyActivities.map((a) => `- ${a.occurredAt?.toISOString().split("T")[0]} ${a.activityType}: ${a.summary || ""}`).join("\n")}`;
        }
        return ctx;
      }
    }
    if (contextType === "contact") {
      const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, contextId), eq(contacts.tenantId, tenantId))).limit(1);
      if (contact) {
        const contactActivities = await db.select().from(activities).where(and(eq(activities.entityId, contextId), eq(activities.entityType, "contact"), eq(activities.tenantId, tenantId))).orderBy(desc(activities.occurredAt)).limit(20);
        const contactNotes = await db.select().from(notes).where(and(eq(notes.entityId, contextId), eq(notes.entityType, "contact"), eq(notes.tenantId, tenantId))).orderBy(desc(notes.createdAt)).limit(10);

        const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown";
        let ctx = `\n\n## Current Context: Contact "${contactName}"
Email: ${contact.email || "unknown"}
Title: ${contact.title || "unknown"}
Company ID: ${contact.companyId || "unknown"}`;

        if (contactActivities.length > 0) {
          ctx += `\n\n### Interaction History (${contactActivities.length} recent)\n${contactActivities.map((a) => `- ${a.occurredAt?.toISOString().split("T")[0]} ${a.activityType} ${a.direction || ""}: ${a.summary || ""}`).join("\n")}`;
        }
        if (contactNotes.length > 0) {
          ctx += `\n\n### Notes\n${contactNotes.map((n) => `- ${n.createdAt?.toISOString().split("T")[0]} ${n.title || ""}: ${n.content?.slice(0, 200) || ""}`).join("\n")}`;
        }
        return ctx;
      }
    }
    if (contextType === "deal") {
      const [deal] = await db.select().from(deals).where(and(eq(deals.id, contextId), eq(deals.tenantId, tenantId))).limit(1);
      if (deal) {
        const dealActivities = await db.select().from(activities).where(and(eq(activities.entityId, contextId), eq(activities.entityType, "deal"), eq(activities.tenantId, tenantId))).orderBy(desc(activities.occurredAt)).limit(20);

        let ctx = `\n\n## Current Context: Deal "${deal.name}"
Stage: ${deal.stage}
Value: ${deal.value ? "$" + deal.value.toLocaleString() : "not set"}
Summary: ${deal.summary || "none"}`;

        // Pull in related contact and account data
        if (deal.contactId) {
          const [dealContact] = await db.select().from(contacts).where(eq(contacts.id, deal.contactId)).limit(1);
          if (dealContact) {
            ctx += `\nPrimary Contact: ${[dealContact.firstName, dealContact.lastName].filter(Boolean).join(" ")} <${dealContact.email}>`;
          }
        }
        if (deal.companyId) {
          const [dealCompany] = await db.select().from(companies).where(eq(companies.id, deal.companyId)).limit(1);
          if (dealCompany) {
            ctx += `\nAccount: ${dealCompany.name} (${dealCompany.industry || "unknown"})`;
          }
        }
        if (dealActivities.length > 0) {
          ctx += `\n\n### Deal Activity\n${dealActivities.map((a) => `- ${a.occurredAt?.toISOString().split("T")[0]} ${a.activityType}: ${a.summary || ""}`).join("\n")}`;
        }
        return ctx;
      }
    }
  } catch {
    // Non-critical
  }
  return "";
}

export async function POST(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages, contextType, contextId }: { messages: UIMessage[]; contextType?: string; contextId?: string } = await req.json();

  const primaryModel = process.env.ANTHROPIC_API_KEY
    ? anthropic("claude-sonnet-4-20250514")
    : null;
  const fallbackModel = process.env.OPENAI_API_KEY
    ? openai("gpt-4o-mini")
    : null;
  const model = primaryModel || fallbackModel;

  if (!model) {
    return new Response(
      "Connect an LLM API key in .env.local for AI capabilities.",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  // Extract last user message for RAG
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUserMessage?.parts
    ?.filter((p) => p.type === "text")
    .map((p) => ("text" in p ? p.text : ""))
    .join("") || "";

  // Parallel: RAG search + CRM snapshot + entity context
  const [ragContext, crmSnapshot, entityContext] = await Promise.all([
    (async () => {
      if (!lastUserText || !process.env.OPENAI_API_KEY) return "";
      try {
        const results = await searchSimilar(lastUserText, 8, authCtx.tenantId);
        if (results.length > 0) {
          const relevant = results.filter((r) => r.similarity > 0.25);
          if (relevant.length > 0) {
            return (
              "\n\n## Relevant CRM Data (from semantic search)\n" +
              relevant
                .map(
                  (r) =>
                    `[${r.entityType}:${r.entityId}] ${r.content} (relevance: ${(r.similarity * 100).toFixed(0)}%)`
                )
                .join("\n")
            );
          }
        }
      } catch (err) {
        console.warn("RAG search failed:", err);
      }
      return "";
    })(),
    getCRMSnapshot(authCtx.tenantId),
    getEntityContext(contextType, contextId, authCtx.tenantId),
  ]);

  const tenantId = authCtx.tenantId;

  const systemPrompt = `You are LeadSens, an autonomous GTM engine for early-stage founders doing founder-led sales. You have DIRECT ACCESS to the user's CRM data and can query it using the tools provided.

## Your capabilities:
- Answer questions about accounts, contacts, deals, and activities using REAL data
- Search the CRM semantically for relevant information
- Create new contacts, accounts, and deals
- Provide sales coaching grounded in specific data points
- Draft personalized emails based on real interaction history
- Track follow-ups and suggest priorities based on activity gaps

## Rules:
- ALWAYS use real data from the CRM. Never make up company names, contact details, or statistics.
- When citing data, reference the specific record (e.g., "Sarah Chen at Acme Corp").
- If the CRM is empty, acknowledge it and guide the user to populate it (import CSV, connect Gmail, or build TAM).
- If data is missing or incomplete, say so honestly. Never hallucinate details.
- When the user asks about records you can see in the snapshot below, answer directly. For deeper searches, use the searchCRM tool.
- Respond in the same language as the user's message.
${crmSnapshot}${ragContext}${entityContext}`;

  const convertedMessages = await convertToModelMessages(messages);

  // Define tools for the chat to interact with CRM
  const searchCRMSchema = z.object({
    query: z.string().describe("Natural language search query"),
    limit: z.number().optional().describe("Max results (default 10)"),
  });
  const queryContactsSchema = z.object({
    search: z.string().optional().describe("Search by name or email"),
    limit: z.number().optional().describe("Max results (default 20)"),
  });
  const queryAccountsSchema = z.object({
    search: z.string().optional().describe("Search by name or domain"),
    limit: z.number().optional().describe("Max results (default 20)"),
  });
  const queryDealsSchema = z.object({
    stage: z.string().optional().describe("Filter by stage: lead, qualification, demo, trial, proposal, negotiation, won, lost"),
    search: z.string().optional().describe("Search by deal name"),
    limit: z.number().optional().describe("Max results (default 20)"),
  });
  const queryActivitiesSchema = z.object({
    entityType: z.string().optional().describe("Filter by entity type: contact, company, deal"),
    entityId: z.string().optional().describe("Filter by specific entity ID"),
    activityType: z.string().optional().describe("Filter by type: email_sent, email_received, meeting_completed, etc."),
    limit: z.number().optional().describe("Max results (default 20)"),
  });
  const createContactSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    title: z.string().optional(),
    phone: z.string().optional(),
    companyId: z.string().optional().describe("Link to an existing account by ID"),
  });
  const createAccountSchema = z.object({
    name: z.string(),
    domain: z.string().optional(),
    industry: z.string().optional(),
  });
  const createDealSchema = z.object({
    name: z.string(),
    stage: z.enum(["lead", "qualification", "demo", "trial", "proposal", "negotiation"]).optional(),
    value: z.number().optional(),
    companyId: z.string().optional(),
    contactId: z.string().optional(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeTool<I>(opts: {
    description: string;
    inputSchema: z.ZodType<I>;
    execute: (input: I) => Promise<any>;
  }) {
    return tool<I, any>({
      description: opts.description,
      inputSchema: opts.inputSchema,
      execute: opts.execute,
    } as any);
  }

  const chatTools = {
    searchCRM: makeTool({
      description: "Search the CRM database semantically. Use this when the user asks about specific contacts, companies, deals, or interactions that may not be in the snapshot.",
      inputSchema: searchCRMSchema,
      execute: async (input) => {
        if (!process.env.OPENAI_API_KEY) return { results: [] as any[], error: "Search unavailable" };
        const results = await searchSimilar(input.query, input.limit ?? 10, tenantId);
        return { results: results.filter((r) => r.similarity > 0.2) };
      },
    }),
    queryContacts: makeTool({
      description: "Query contacts with optional text search. Use when user asks to find or filter contacts.",
      inputSchema: queryContactsSchema,
      execute: async (input) => {
        const results = await db
          .select()
          .from(contacts)
          .where(
            input.search
              ? and(
                  eq(contacts.tenantId, tenantId),
                  or(
                    ilike(contacts.firstName, `%${input.search}%`),
                    ilike(contacts.lastName, `%${input.search}%`),
                    ilike(contacts.email, `%${input.search}%`)
                  )
                )
              : eq(contacts.tenantId, tenantId)
          )
          .orderBy(desc(contacts.createdAt))
          .limit(input.limit ?? 20);
        return { contacts: results.map((c) => ({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" "), email: c.email, title: c.title, companyId: c.companyId })) };
      },
    }),
    queryAccounts: makeTool({
      description: "Query accounts/companies with optional text search.",
      inputSchema: queryAccountsSchema,
      execute: async (input) => {
        const results = await db
          .select()
          .from(companies)
          .where(
            input.search
              ? and(
                  eq(companies.tenantId, tenantId),
                  or(
                    ilike(companies.name, `%${input.search}%`),
                    ilike(companies.domain, `%${input.search}%`)
                  )
                )
              : eq(companies.tenantId, tenantId)
          )
          .orderBy(desc(companies.createdAt))
          .limit(input.limit ?? 20);
        return { accounts: results.map((a) => ({ id: a.id, name: a.name, domain: a.domain, industry: a.industry, score: a.score, size: a.size, revenue: a.revenue })) };
      },
    }),
    queryDeals: makeTool({
      description: "Query deals/opportunities with optional filter by stage.",
      inputSchema: queryDealsSchema,
      execute: async (input) => {
        const conditions = [eq(deals.tenantId, tenantId)];
        if (input.stage) conditions.push(eq(deals.stage, input.stage as any));
        if (input.search) conditions.push(ilike(deals.name, `%${input.search}%`));
        const results = await db
          .select()
          .from(deals)
          .where(and(...conditions))
          .orderBy(desc(deals.createdAt))
          .limit(input.limit ?? 20);
        return { deals: results.map((d) => ({ id: d.id, name: d.name, stage: d.stage, value: d.value, companyId: d.companyId, contactId: d.contactId, expectedCloseDate: d.expectedCloseDate })) };
      },
    }),
    queryActivities: makeTool({
      description: "Query recent activities for a contact, account, or all. Use to answer questions about interactions, last contact date, follow-ups needed.",
      inputSchema: queryActivitiesSchema,
      execute: async (input) => {
        const conditions = [eq(activities.tenantId, tenantId)];
        if (input.entityType) conditions.push(eq(activities.entityType, input.entityType));
        if (input.entityId) conditions.push(eq(activities.entityId, input.entityId));
        if (input.activityType) conditions.push(eq(activities.activityType, input.activityType as any));
        const results = await db
          .select()
          .from(activities)
          .where(and(...conditions))
          .orderBy(desc(activities.occurredAt))
          .limit(input.limit ?? 20);
        return {
          activities: results.map((a) => ({
            id: a.id,
            type: a.activityType,
            summary: a.summary,
            direction: a.direction,
            channel: a.channel,
            occurredAt: a.occurredAt,
            entityType: a.entityType,
            entityId: a.entityId,
          })),
        };
      },
    }),
    createContact: makeTool({
      description: "Create a new contact in the CRM. Use when the user asks to add a contact.",
      inputSchema: createContactSchema,
      execute: async (input) => {
        const [created] = await db
          .insert(contacts)
          .values({ tenantId, ...input })
          .returning();
        return { created: { id: created.id, name: [created.firstName, created.lastName].filter(Boolean).join(" "), email: created.email } };
      },
    }),
    createAccount: makeTool({
      description: "Create a new account/company in the CRM.",
      inputSchema: createAccountSchema,
      execute: async (input) => {
        const [created] = await db
          .insert(companies)
          .values({ tenantId, ...input })
          .returning();
        return { created: { id: created.id, name: created.name, domain: created.domain } };
      },
    }),
    createDeal: makeTool({
      description: "Create a new deal/opportunity in the CRM.",
      inputSchema: createDealSchema,
      execute: async (input) => {
        const [created] = await db
          .insert(deals)
          .values({ tenantId, stage: input.stage ?? "lead", name: input.name, value: input.value, companyId: input.companyId, contactId: input.contactId })
          .returning();
        return { created: { id: created.id, name: created.name, stage: created.stage, value: created.value } };
      },
    }),
  };

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: convertedMessages,
      tools: chatTools,
      stopWhen: stepCountIs(5),
    });
    return result.toTextStreamResponse();
  } catch (err) {
    if (model === primaryModel && fallbackModel) {
      console.warn("Primary model failed, falling back to OpenAI:", err);
      const result = streamText({
        model: fallbackModel,
        system: systemPrompt,
        messages: convertedMessages,
        tools: chatTools,
        stopWhen: stepCountIs(5),
      });
      return result.toTextStreamResponse();
    }
    return Response.json(
      { error: "AI service temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
}
