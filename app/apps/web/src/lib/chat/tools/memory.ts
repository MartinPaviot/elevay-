import { db } from "@/db";
import { chatMemories } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { exploreGraphAroundEntity } from "@/lib/context-graph";
import { makeTool, type ToolContext } from "./context";

export function buildMemoryTools(ctx: ToolContext) {
  const { tenantId, userId } = ctx;

  return {
    exploreGraph: makeTool({
      description:
        "Explore the context graph around an entity. Returns connected entities and facts (relationships, interactions, temporal history). Use when user asks 'what do we know about X', 'show me connections for Y', 'graph for Z', or 'context around X'.",
      inputSchema: z.object({
        entityName: z
          .string()
          .describe("Name of the entity to explore (person, company, topic)"),
        depth: z.number().optional().describe("How many hops to traverse (default 2, max 3)"),
      }),
      execute: async (input) => {
        const result = await exploreGraphAroundEntity(
          input.entityName,
          tenantId,
          Math.min(input.depth || 2, 3)
        );
        if (result.nodes.length === 0)
          return { message: `No entity found matching "${input.entityName}" in the context graph` };
        return {
          entities: result.nodes.map((n) => ({ name: n.name, type: n.type, summary: n.summary })),
          facts: result.edges.map((e) => ({
            from: result.nodes.find((n) => n.id === e.source)?.name,
            to: result.nodes.find((n) => n.id === e.target)?.name,
            relation: e.relation,
            fact: e.fact,
            valid: e.valid,
          })),
          graphUrl: `/graph`,
        };
      },
    }),

    rememberContext: makeTool({
      description: `Save a piece of information to persistent memory for future conversations. Use when the user shares a preference, makes a decision, or reveals context that should be remembered across sessions. Examples: key="communication_style" content="User prefers concise bullet points". key="deal_strategy_acme" content="User wants to push for enterprise plan, avoid discounts".`,
      inputSchema: z.object({
        key: z
          .string()
          .describe("Short identifier for this memory (e.g. communication_style, deal_strategy_acme)"),
        content: z.string().describe("The information to remember"),
        category: z
          .enum(["user_preference", "decision", "learned_context", "relationship_note"])
          .optional(),
      }),
      execute: async (input) => {
        const existing = await db
          .select()
          .from(chatMemories)
          .where(
            and(
              eq(chatMemories.tenantId, tenantId),
              eq(chatMemories.userId, userId),
              eq(chatMemories.key, input.key)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(chatMemories)
            .set({
              content: input.content,
              category: input.category || existing[0].category,
              updatedAt: new Date(),
            })
            .where(eq(chatMemories.id, existing[0].id));
          return { remembered: true, action: "updated", key: input.key };
        }

        await db.insert(chatMemories).values({
          tenantId,
          userId,
          key: input.key,
          content: input.content,
          category: input.category || "learned_context",
        });
        return { remembered: true, action: "created", key: input.key };
      },
    }),

    recallMemories: makeTool({
      description: `Retrieve all saved memories for the current user. Use at the start of complex tasks to check what you already know about the user's preferences and past decisions.`,
      inputSchema: z.object({
        category: z
          .string()
          .optional()
          .describe(
            "Filter by category: user_preference, decision, learned_context, relationship_note"
          ),
      }),
      execute: async (input) => {
        const conditions = [
          eq(chatMemories.tenantId, tenantId),
          eq(chatMemories.userId, userId),
        ];
        if (input.category) conditions.push(eq(chatMemories.category, input.category));
        const memories = await db
          .select()
          .from(chatMemories)
          .where(and(...conditions))
          .orderBy(desc(chatMemories.updatedAt))
          .limit(30);
        return {
          memories: memories.map((m) => ({
            key: m.key,
            content: m.content,
            category: m.category,
            updatedAt: m.updatedAt,
          })),
        };
      },
    }),
  };
}
