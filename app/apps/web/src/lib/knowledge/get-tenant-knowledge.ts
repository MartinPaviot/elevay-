import { db } from "@/db";
import { knowledgeEntries } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  KNOWLEDGE_STAGES,
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

/**
 * Compact index of the whole knowledge base for the chat system prompt:
 * every entry's title grouped under the sales moment it serves, with its
 * category tag. The chat sees WHAT exists on every turn and pulls FULL
 * content deliberately via the getKnowledge tool — picking the right
 * information no longer depends on embedding luck. Pure (derives stages
 * itself so callers can pass raw rows).
 */
export function formatKnowledgeIndex(
  rows: Array<{ title: string; category: string; stages: unknown }>,
  cap = 60,
): string {
  if (rows.length === 0) return "";
  const byStage = new Map<KnowledgeStage, Array<{ title: string; category: string }>>();
  for (const r of rows.slice(0, cap)) {
    const stages = effectiveStages(r.stages, r.category, r.title);
    const primary = stages[0] ?? "global";
    if (!byStage.has(primary)) byStage.set(primary, []);
    byStage.get(primary)!.push({ title: r.title, category: r.category });
  }
  const sections: string[] = [];
  for (const s of KNOWLEDGE_STAGES) {
    const list = byStage.get(s.key);
    if (!list || list.length === 0) continue;
    sections.push(`${s.label}:\n${list.map((e) => `- "${e.title}" (${e.category})`).join("\n")}`);
  }
  return `## Knowledge Index\nEverything documented about this workspace's business, grouped by the sales moment it serves. When the user's request touches one of these, fetch the FULL entry with the getKnowledge tool (pass the exact title) and ground your answer in it — never answer from a title alone, and prefer these documented approaches over generic advice.\n\n${sections.join("\n\n")}`;
}
