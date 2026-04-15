import { db } from "@/db";
import { activities, companies, contacts, deals, notes, tasks } from "@/db/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { searchSimilar } from "@/lib/embeddings";
import { makeTool, type ToolContext } from "./context";

export function buildQueryTools(ctx: ToolContext) {
  const { tenantId } = ctx;

  return {
    searchCRM: makeTool({
      description: `Search the CRM database semantically using vector embeddings. Use when looking for specific records by name, attribute, or topic that may not be in the snapshot.
Examples: query="Sarah Chen" finds contacts named Sarah Chen. query="deals over 50K" finds high-value deals. query="companies using React" finds companies with React in their tech stack. query="recent meetings about pricing" finds meeting activities discussing pricing.`,
      inputSchema: z.object({
        query: z.string().describe("Natural language search query"),
        limit: z.number().optional().describe("Max results (default 10)"),
      }),
      execute: async (input) => {
        if (!process.env.OPENAI_API_KEY) return { results: [] as unknown[], error: "Search unavailable" };
        const results = await searchSimilar(input.query, input.limit ?? 10, tenantId);
        return { results: results.filter((r) => r.similarity > 0.5) };
      },
    }),

    queryContacts: makeTool({
      description: `Query contacts with optional text search by name or email. Use when user asks to find, list, or filter contacts. Examples: search="Sarah" finds all contacts named Sarah. search="acme.com" finds contacts with acme.com emails. Omit search to list recent contacts.`,
      inputSchema: z.object({
        search: z.string().optional().describe("Search by name or email"),
        limit: z.number().optional().describe("Max results (default 20)"),
      }),
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
        return {
          contacts: results.map((c) => ({
            id: c.id,
            name: [c.firstName, c.lastName].filter(Boolean).join(" "),
            email: c.email,
            title: c.title,
            companyId: c.companyId,
          })),
        };
      },
    }),

    queryAccounts: makeTool({
      description: `Query accounts/companies with optional text search by name or domain. Examples: search="Meridian" finds Meridian Labs. search="fintech" finds fintech companies. Omit search to list recent accounts.`,
      inputSchema: z.object({
        search: z.string().optional().describe("Search by name or domain"),
        limit: z.number().optional().describe("Max results (default 20)"),
      }),
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
        return {
          accounts: results.map((a) => ({
            id: a.id,
            name: a.name,
            domain: a.domain,
            industry: a.industry,
            score: a.score,
            size: a.size,
            revenue: a.revenue,
          })),
        };
      },
    }),

    queryDeals: makeTool({
      description: `Query deals/opportunities with optional filters by stage or name. Examples: stage="proposal" lists all deals in proposal stage. search="Acme" finds the Acme deal. Omit both to list all active deals.`,
      inputSchema: z.object({
        stage: z.string().optional().describe("Filter by stage: lead, qualification, demo, trial, proposal, negotiation, won, lost"),
        search: z.string().optional().describe("Search by deal name"),
        limit: z.number().optional().describe("Max results (default 20)"),
      }),
      execute: async (input) => {
        const conditions = [eq(deals.tenantId, tenantId)];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (input.stage) conditions.push(eq(deals.stage, input.stage as any));
        if (input.search) conditions.push(ilike(deals.name, `%${input.search}%`));
        const results = await db
          .select()
          .from(deals)
          .where(and(...conditions))
          .orderBy(desc(deals.createdAt))
          .limit(input.limit ?? 20);
        return {
          deals: results.map((d) => ({
            id: d.id,
            name: d.name,
            stage: d.stage,
            value: d.value,
            companyId: d.companyId,
            contactId: d.contactId,
            expectedCloseDate: d.expectedCloseDate,
          })),
        };
      },
    }),

    queryActivities: makeTool({
      description: `Query recent activities (emails, meetings, calls, notes) for a specific contact, account, deal, or all. Use for: "when did I last talk to X", "what happened with Y", follow-up gaps, interaction history. Returns full email bodies and metadata for citation. Examples: entityType="contact" + entityId="abc" gets all interactions with that contact. activityType="email_received" filters to received emails only.`,
      inputSchema: z.object({
        entityType: z.string().optional().describe("Filter by entity type: contact, company, deal"),
        entityId: z.string().optional().describe("Filter by specific entity ID"),
        activityType: z.string().optional().describe("Filter by type: email_sent, email_received, meeting_completed, etc."),
        limit: z.number().optional().describe("Max results (default 20)"),
      }),
      execute: async (input) => {
        const conditions = [eq(activities.tenantId, tenantId)];
        if (input.entityType) conditions.push(eq(activities.entityType, input.entityType));
        if (input.entityId) conditions.push(eq(activities.entityId, input.entityId));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (input.activityType) conditions.push(eq(activities.activityType, input.activityType as any));
        const results = await db
          .select()
          .from(activities)
          .where(and(...conditions))
          .orderBy(desc(activities.occurredAt))
          .limit(input.limit ?? 20);
        return {
          activities: results.map((a) => {
            const meta = (a.metadata || {}) as Record<string, unknown>;
            return {
              id: a.id,
              type: a.activityType,
              summary: a.summary,
              direction: a.direction,
              channel: a.channel,
              occurredAt: a.occurredAt,
              entityType: a.entityType,
              entityId: a.entityId,
              emailBody: meta.body ? (meta.body as string).slice(0, 2000) : undefined,
              body: a.rawContent ? a.rawContent.slice(0, 2000) : undefined,
              emailFrom: meta.from,
              emailTo: meta.to,
              structuredNotes: meta.structuredNotes,
              _sourceLink:
                a.entityType === "contact"
                  ? `/contacts/${a.entityId}`
                  : a.entityType === "company"
                    ? `/accounts/${a.entityId}`
                    : a.entityType === "deal"
                      ? `/opportunities/${a.entityId}`
                      : undefined,
            };
          }),
        };
      },
    }),

    queryNotes: makeTool({
      description: "Query notes for a contact, account, deal, or all notes. Use when the user asks about notes, observations, or written context. Returns full note content for citation.",
      inputSchema: z.object({
        entityType: z.string().optional().describe("Filter by entity type: contact, company, deal"),
        entityId: z.string().optional().describe("Filter by specific entity ID"),
        search: z.string().optional().describe("Search by note title or content"),
        limit: z.number().optional().describe("Max results (default 20)"),
      }),
      execute: async (input) => {
        const conditions = [eq(notes.tenantId, tenantId)];
        if (input.entityType) conditions.push(eq(notes.entityType, input.entityType));
        if (input.entityId) conditions.push(eq(notes.entityId, input.entityId));
        if (input.search) {
          conditions.push(
            or(
              ilike(notes.title, `%${input.search}%`),
              ilike(notes.content, `%${input.search}%`)
            )!
          );
        }
        const results = await db
          .select()
          .from(notes)
          .where(and(...conditions))
          .orderBy(desc(notes.createdAt))
          .limit(input.limit ?? 20);
        return {
          notes: results.map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            entityType: n.entityType,
            entityId: n.entityId,
            createdAt: n.createdAt,
            _sourceLink:
              n.entityType === "contact"
                ? `/contacts/${n.entityId}`
                : n.entityType === "company"
                  ? `/accounts/${n.entityId}`
                  : n.entityType === "deal"
                    ? `/opportunities/${n.entityId}`
                    : undefined,
          })),
        };
      },
    }),

    queryTasks: makeTool({
      description: "Query tasks with optional filters. Use when user asks about their tasks, to-dos, follow-ups, or what's due.",
      inputSchema: z.object({
        status: z.string().optional().describe("Filter by status: pending, completed, cancelled"),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        limit: z.number().optional(),
      }),
      execute: async (input) => {
        const conditions = [eq(tasks.tenantId, tenantId)];
        if (input.status) conditions.push(eq(tasks.status, input.status));
        if (input.entityType) conditions.push(eq(tasks.entityType, input.entityType));
        if (input.entityId) conditions.push(eq(tasks.entityId, input.entityId));
        const results = await db
          .select()
          .from(tasks)
          .where(and(...conditions))
          .orderBy(desc(tasks.dueDate))
          .limit(input.limit ?? 20);
        return {
          tasks: results.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            entityType: t.entityType,
            entityId: t.entityId,
          })),
        };
      },
    }),
  };
}
