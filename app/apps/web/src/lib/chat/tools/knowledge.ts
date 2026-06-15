import { z } from "zod";
import { makeTool, type ToolContext } from "./context";
import { db } from "@/db";
import { knowledgeEntries } from "@/db/schema";
import { and, eq, or, inArray } from "drizzle-orm";
import { effectiveStages, isKnowledgeStage, STAGE_KEYS } from "@/lib/knowledge/stages";
import { getTenantKnowledgeForStage } from "@/lib/knowledge/get-tenant-knowledge";
import { retrieveKnowledge } from "@/lib/knowledge/retrieval";

/**
 * Knowledge tools — the deliberate-selection half of the chat's knowledge
 * awareness. The system prompt carries a compact Knowledge Index (every
 * title, grouped by stage — formatKnowledgeIndex); this tool fetches the
 * FULL content of any entry the index shows is relevant, by exact title,
 * by stage, or by semantic query. Always available (query group), so the
 * model never has to answer from a title or hope the auto-retrieval
 * guessed right.
 */
export function buildKnowledgeTools(ctx: ToolContext) {
  const { tenantId } = ctx;

  return {
    getKnowledge: makeTool({
      description:
        `Fetch FULL knowledge-base entries (the workspace's documented business knowledge: company facts, playbooks, objection responses, ICP...). Three ways: exact \`titles\` (preferred — the Knowledge Index in your context lists every available title), a \`stage\` (${STAGE_KEYS.join(" | ")}) to get everything serving that sales moment, or a semantic \`query\`. Use it whenever the index shows an entry relevant to the user's request, then ground your answer in the fetched content — never from a title alone.`,
      inputSchema: z.object({
        titles: z.array(z.string()).optional().describe("Exact entry titles, copied from the Knowledge Index"),
        stage: z.string().optional().describe(`One sales moment: ${STAGE_KEYS.join(", ")}`),
        query: z.string().optional().describe("Semantic search, when no exact title fits"),
        limit: z.number().optional().describe("Max entries to return (default 8, cap 20)"),
      }),
      execute: async (input) => {
        const limit = Math.min(20, Math.max(1, input.limit ?? 8));

        if (input.titles && input.titles.length > 0) {
          const wanted = input.titles.slice(0, 20);
          const rows = await db
            .select()
            .from(knowledgeEntries)
            .where(
              and(
                eq(knowledgeEntries.tenantId, tenantId),
                eq(knowledgeEntries.isActive, true),
                inArray(knowledgeEntries.title, wanted),
                or(
                  eq(knowledgeEntries.scope, "workspace"),
                  and(eq(knowledgeEntries.scope, "user"), eq(knowledgeEntries.createdBy, ctx.userId)),
                ),
              ),
            )
            .limit(limit);
          return {
            count: rows.length,
            entries: rows.map((r) => ({
              title: r.title,
              category: r.category,
              stages: effectiveStages(r.stages, r.category, r.title),
              content: r.content,
            })),
            ...(rows.length < wanted.length
              ? { note: "Some titles were not found — copy exact titles from the Knowledge Index." }
              : {}),
          };
        }

        if (input.stage) {
          if (!isKnowledgeStage(input.stage)) {
            return { error: `Unknown stage "${input.stage}". Use one of: ${STAGE_KEYS.join(", ")}` };
          }
          const entries = await getTenantKnowledgeForStage(tenantId, input.stage, { limit });
          return {
            count: entries.length,
            entries: entries.map((e) => ({
              title: e.topic,
              category: e.category,
              stages: e.stages,
              content: e.content,
            })),
          };
        }

        if (input.query?.trim()) {
          const found = await retrieveKnowledge(input.query, tenantId, { userId: ctx.userId, limit });
          return {
            count: found.length,
            entries: found.map((e) => ({ title: e.title, category: e.category, content: e.content })),
          };
        }

        return { error: "Provide titles (preferred), a stage, or a query." };
      },
    }),
  };
}
