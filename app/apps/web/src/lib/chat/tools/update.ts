import { db } from "@/db";
import { activities, contacts, deals, tasks } from "@/db/schema";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { makeTool, type ToolContext } from "./context";

export function buildUpdateTools(ctx: ToolContext) {
  const { tenantId, userId } = ctx;

  return {
    updateDealStage: makeTool({
      description:
        "Move a deal to a different pipeline stage. Use when the user says 'move deal X to proposal', 'progress this deal', 'mark as won/lost', etc.",
      inputSchema: z.object({
        dealId: z.string().describe("The deal ID to update"),
        newStage: z
          .string()
          .describe("The new stage name (e.g. qualification, demo, proposal, won, lost)"),
      }),
      execute: async (input) => {
        const [deal] = await db
          .select()
          .from(deals)
          .where(and(eq(deals.id, input.dealId), eq(deals.tenantId, tenantId)))
          .limit(1);
        if (!deal) return { error: "Deal not found" };

        const oldStage = deal.stage;
        await db
          .update(deals)
          .set({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stage: input.newStage as any,
            updatedAt: new Date(),
          })
          .where(and(eq(deals.id, input.dealId), eq(deals.tenantId, tenantId)));

        await db.insert(activities).values({
          tenantId,
          actorType: "user",
          actorId: userId,
          entityType: "deal",
          entityId: input.dealId,
          activityType:
            input.newStage === "won"
              ? "deal_won"
              : input.newStage === "lost"
                ? "deal_lost"
                : "deal_stage_changed",
          channel: "system",
          direction: "internal",
          summary: `Stage changed from ${oldStage} to ${input.newStage}`,
          metadata: { oldStage, newStage: input.newStage },
        });

        return { updated: { id: deal.id, name: deal.name, oldStage, newStage: input.newStage } };
      },
    }),

    completeTask: makeTool({
      description: "Mark a task as completed. Use when user says 'done', 'complete task', 'mark as finished'.",
      inputSchema: z.object({
        taskId: z.string().describe("Task ID to mark as completed"),
      }),
      execute: async (input) => {
        const [updated] = await db
          .update(tasks)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(and(eq(tasks.id, input.taskId), eq(tasks.tenantId, tenantId)))
          .returning();
        if (!updated) return { error: "Task not found" };
        return { completed: { id: updated.id, title: updated.title } };
      },
    }),

    bulkUpdateDeals: makeTool({
      description:
        "Bulk update multiple deals at once. Use when user says 'reassign all deals', 'move all X deals to Y stage', 'tag all deals with', or any bulk deal operation.",
      inputSchema: z.object({
        filter: z
          .object({
            stage: z.string().optional().describe("Filter deals by current stage"),
            search: z.string().optional().describe("Filter deals by name search"),
          })
          .describe("Filter to select which deals to update"),
        update: z
          .object({
            stage: z.string().optional().describe("New stage to set"),
            assigneeId: z.string().optional().describe("New assignee user ID"),
          })
          .describe("Fields to update on matched deals"),
      }),
      execute: async (input) => {
        const conditions = [eq(deals.tenantId, tenantId)];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (input.filter.stage) conditions.push(eq(deals.stage, input.filter.stage as any));
        if (input.filter.search) conditions.push(ilike(deals.name, `%${input.filter.search}%`));

        const matchedDeals = await db
          .select({ id: deals.id, name: deals.name, stage: deals.stage })
          .from(deals)
          .where(and(...conditions));

        if (matchedDeals.length === 0)
          return { bulkUpdated: { count: 0 }, message: "No deals matched the filter" };

        const updateFields: Record<string, unknown> = { updatedAt: new Date() };
        if (input.update.stage) updateFields.stage = input.update.stage;

        await db
          .update(deals)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(updateFields as any)
          .where(and(...conditions));

        for (const deal of matchedDeals) {
          await db.insert(activities).values({
            tenantId,
            actorType: "user",
            actorId: userId,
            entityType: "deal",
            entityId: deal.id,
            activityType: "deal_stage_changed",
            channel: "system",
            direction: "internal",
            summary: `Bulk update: ${Object.entries(input.update)
              .map(([k, v]) => `${k}→${v}`)
              .join(", ")}`,
            metadata: { bulkOperation: true, filter: input.filter, update: input.update },
          });
        }

        return {
          bulkUpdated: {
            count: matchedDeals.length,
            deals: matchedDeals.map((d) => ({ id: d.id, name: d.name })),
          },
        };
      },
    }),

    bulkUpdateContacts: makeTool({
      description:
        "Bulk update multiple contacts. Use when user says 'tag all contacts at X', 'update all contacts with', or any bulk contact operation.",
      inputSchema: z.object({
        filter: z
          .object({
            companyId: z.string().optional().describe("Filter by company ID"),
            search: z.string().optional().describe("Filter by name/email search"),
          })
          .describe("Filter to select which contacts to update"),
        update: z
          .object({
            title: z.string().optional(),
            companyId: z.string().optional(),
          })
          .describe("Fields to update on matched contacts"),
      }),
      execute: async (input) => {
        const conditions = [eq(contacts.tenantId, tenantId)];
        if (input.filter.companyId) conditions.push(eq(contacts.companyId, input.filter.companyId));
        if (input.filter.search) {
          conditions.push(
            or(
              ilike(contacts.firstName, `%${input.filter.search}%`),
              ilike(contacts.lastName, `%${input.filter.search}%`),
              ilike(contacts.email, `%${input.filter.search}%`)
            )!
          );
        }

        const matchedContacts = await db
          .select({
            id: contacts.id,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
          })
          .from(contacts)
          .where(and(...conditions));

        if (matchedContacts.length === 0)
          return { bulkUpdated: { count: 0 }, message: "No contacts matched the filter" };

        const updateFields: Record<string, unknown> = { updatedAt: new Date() };
        if (input.update.title) updateFields.title = input.update.title;
        if (input.update.companyId) updateFields.companyId = input.update.companyId;

        await db
          .update(contacts)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(updateFields as any)
          .where(and(...conditions));

        return {
          bulkUpdated: {
            count: matchedContacts.length,
            contacts: matchedContacts.map((c) => ({
              id: c.id,
              name: [c.firstName, c.lastName].filter(Boolean).join(" "),
            })),
          },
        };
      },
    }),
  };
}
