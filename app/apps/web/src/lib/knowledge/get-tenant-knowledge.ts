import { db } from "@/db";
import { knowledgeEntries } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  effectiveStages,
  entryMatchesStage,
  type KnowledgeStage,
} from "./stages";

export interface TenantKnowledgeEntry {
  id: string;
  topic: string;
  content: string;
  category: string;
  /** Effective consumption stages (stored when curated, else derived). */
  stages: KnowledgeStage[];
}

/**
 * Single read path for tenant Knowledge. All code that needs Knowledge
 * entries should call this instead of reading settings.knowledge.
 *
 * Reads from knowledge_entries table (primary) with fallback to
 * settings.knowledge JSONB (legacy, for tenants that haven't migrated).
 */
export async function getTenantKnowledge(
  tenantId: string,
  options?: { limit?: number },
): Promise<TenantKnowledgeEntry[]> {
  const limit = options?.limit ?? 20;

  try {
    const rows = await db
      .select({
        id: knowledgeEntries.id,
        title: knowledgeEntries.title,
        content: knowledgeEntries.content,
        category: knowledgeEntries.category,
        stages: knowledgeEntries.stages,
      })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.tenantId, tenantId),
          eq(knowledgeEntries.isActive, true),
          eq(knowledgeEntries.scope, "workspace"),
        ),
      )
      .orderBy(desc(knowledgeEntries.updatedAt))
      .limit(limit);

    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        topic: r.title,
        content: r.content,
        category: r.category,
        stages: effectiveStages(r.stages, r.category, r.title),
      }));
    }
  } catch {
    // Table (or the stages column) may not exist yet — fall through to legacy
  }

  // Legacy fallback: read from settings.knowledge JSONB
  try {
    const { getTenantSettings } = await import("@/lib/config/tenant-settings");
    const settings = await getTenantSettings(tenantId);
    const legacy = (settings.knowledge || []) as Array<{ id?: string; topic: string; content: string }>;
    return legacy.map((k) => ({
      id: k.id ?? "",
      topic: k.topic,
      content: k.content,
      category: "custom",
      stages: effectiveStages([], "custom", k.topic),
    }));
  } catch {
    return [];
  }
}

/**
 * The entries one product STAGE should consume — stored/derived stages,
 * `global` entries included by default (they are wanted everywhere).
 * This is the precision seam: TAM pulls "sourcing", script generation
 * pulls "cold_call", email drafting pulls "outreach" — instead of every
 * consumer ingesting the whole knowledge base.
 */
export async function getTenantKnowledgeForStage(
  tenantId: string,
  stage: KnowledgeStage,
  options?: { limit?: number; includeGlobal?: boolean },
): Promise<TenantKnowledgeEntry[]> {
  const all = await getTenantKnowledge(tenantId, { limit: options?.limit ?? 50 });
  return all.filter((e) =>
    entryMatchesStage(e.stages, stage, { includeGlobal: options?.includeGlobal }),
  );
}

/**
 * Format Knowledge entries as a text block for LLM prompts.
 */
export function formatKnowledgeBlock(entries: TenantKnowledgeEntry[]): string {
  if (entries.length === 0) return "";
  return entries.map((k) => `- ${k.topic}: ${k.content}`).join("\n");
}
