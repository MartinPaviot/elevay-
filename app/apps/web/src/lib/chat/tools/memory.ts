import { db } from "@/db";
import { chatMemories } from "@/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { exploreGraphAroundEntity } from "@/lib/context-graph";
import { makeTool, type ToolContext } from "./context";

export function buildMemoryTools(ctx: ToolContext) {
  const { tenantId, userId, authCtx } = ctx;
  const isAdmin = authCtx.role === "admin";

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
      description: `Save a piece of information to persistent memory for future conversations. Use when the user shares a preference, makes a decision, or reveals context that should be remembered across sessions. Scope defaults to 'user' (private); use 'workspace' for team-shared facts (admin-only write). Examples: key="communication_style" content="User prefers concise bullet points" scope="user". key="our_icp" content="B2B startups 10-50 FTE series A" scope="workspace".`,
      inputSchema: z.object({
        key: z
          .string()
          .describe("Short identifier for this memory (e.g. communication_style, our_icp)"),
        content: z.string().describe("The information to remember"),
        category: z
          .enum(["user_preference", "decision", "learned_context", "relationship_note"])
          .optional(),
        scope: z
          .enum(["user", "workspace"])
          .optional()
          .describe("Visibility: 'user' (private to me, default) or 'workspace' (shared with all members — admin-only)"),
      }),
      execute: async (input) => {
        const scope = input.scope || "user";
        if (scope === "workspace" && !isAdmin) {
          return { error: "Admin access required to write workspace-scoped memories" };
        }

        // For workspace memories, match on (tenantId, scope, key) — authorId
        // doesn't matter for dedup since anyone in the workspace can find it.
        // For user memories, match on (tenantId, userId, scope, key).
        const baseConditions = [
          eq(chatMemories.tenantId, tenantId),
          eq(chatMemories.key, input.key),
          eq(chatMemories.scope, scope),
        ];
        if (scope === "user") {
          baseConditions.push(eq(chatMemories.userId, userId));
        }
        const existing = await db
          .select()
          .from(chatMemories)
          .where(and(...baseConditions))
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
          return { remembered: true, action: "updated", key: input.key, scope };
        }

        // Author is always the real user (FK'd). Scope column is the
        // audience gate.
        await db.insert(chatMemories).values({
          tenantId,
          userId,
          key: input.key,
          content: input.content,
          category: input.category || "learned_context",
          scope,
        });
        return { remembered: true, action: "created", key: input.key, scope };
      },
    }),

    recallMemories: makeTool({
      description: `Retrieve all saved memories for the current user — includes private ('user' scope) memories plus any 'workspace'-scoped memories visible to all workspace members.`,
      inputSchema: z.object({
        category: z
          .string()
          .optional()
          .describe(
            "Filter by category: user_preference, decision, learned_context, relationship_note"
          ),
        scope: z
          .enum(["user", "workspace", "all"])
          .optional()
          .describe("Filter by scope (default 'all' — returns both user and workspace)"),
      }),
      execute: async (input) => {
        const scopeFilter = input.scope || "all";
        const scopeClause =
          scopeFilter === "user"
            ? and(eq(chatMemories.scope, "user"), eq(chatMemories.userId, userId))
            : scopeFilter === "workspace"
              ? eq(chatMemories.scope, "workspace")
              : or(
                  eq(chatMemories.scope, "workspace"),
                  and(
                    eq(chatMemories.scope, "user"),
                    eq(chatMemories.userId, userId)
                  )
                );

        const conditions = [eq(chatMemories.tenantId, tenantId), scopeClause!];
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
            scope: m.scope,
            updatedAt: m.updatedAt,
          })),
        };
      },
    }),

    forgetMemory: makeTool({
      description: `Delete a saved memory by key. Scope defaults to 'user' — admin can pass scope='workspace' to delete shared memories. Use when the user says 'forget that', 'remove the X memory'.`,
      inputSchema: z.object({
        key: z.string().describe("Memory key to forget"),
        scope: z.enum(["user", "workspace"]).optional(),
      }),
      execute: async (input) => {
        const scope = input.scope || "user";
        if (scope === "workspace" && !isAdmin) {
          return { error: "Admin access required to delete workspace-scoped memories" };
        }
        const conditions = [
          eq(chatMemories.tenantId, tenantId),
          eq(chatMemories.key, input.key),
          eq(chatMemories.scope, scope),
        ];
        // For user-scoped forgets, only delete the current user's row
        if (scope === "user") {
          conditions.push(eq(chatMemories.userId, userId));
        }
        const result = await db
          .delete(chatMemories)
          .where(and(...conditions))
          .returning({ id: chatMemories.id });
        return { forgotten: result.length > 0, key: input.key, scope };
      },
    }),
  };
}
