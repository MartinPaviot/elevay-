/**
 * Seed the founder's real messaging into a tenant: copy asset blocks
 * (positioning / offer / cta — what generateMessage assembles into every
 * outbound body), optional voice guide, and knowledge-base entries (what
 * reply drafting cites for pricing/objections/competitors).
 *
 * WHY: the engine is idle because copy_asset_block has 0 rows platform-wide
 * (2026-06-26 copy-quality eval) and the KB is unseeded — the missing piece is
 * founder DATA, not code. This script loads a founder-filled JSON through the
 * SAME prod primitives the API routes use (saveAssetVersion + the knowledge
 * insert+embed recipe), so nothing bypasses versioning or embeddings.
 *
 * Run (dry-run by default — prints what it WOULD do):
 *   npx tsx --env-file=.env.local scripts/seed-messaging.ts
 * Apply for real:
 *   npx tsx --env-file=.env.local scripts/seed-messaging.ts --apply
 *
 * Input: scripts/seed-messaging.local.json (gitignored — the filled file holds
 * the founder's messaging and never reaches the public repo). Copy
 * scripts/seed-messaging.example.json to start.
 *
 * Idempotent: an asset whose current content is identical is skipped; a KB
 * entry with the same title + content hash is skipped; same title but changed
 * content is reported (edit via /settings/knowledge), never overwritten.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeEntries, authUsers } from "@/db/schema";
import { assetStoreFor } from "@/lib/copy/assets/db-store";
import { saveAssetVersion, saveVoiceGuideVersion } from "@/lib/copy/assets/store";
import type { AssetKind, Lang, VoiceGuide } from "@/lib/copy/assets/resolve";
import { embedKnowledgeEntry } from "@/lib/knowledge/retrieval";

interface SeedFile {
  tenantId: string;
  /** Email of an existing (admin) user — becomes knowledge createdBy. */
  createdByEmail: string;
  lang: Lang;
  /** kind → content. Only positioning/offer/cta are assembled into messages. */
  assets: Partial<Record<AssetKind, string>>;
  voice?: {
    bannedWords?: string[];
    favoredPhrasings?: string[];
    formats?: string[];
    frFormality?: VoiceGuide["frFormality"];
  };
  knowledge: Array<{ title: string; category: string; content: string }>;
}

const APPLY = process.argv.includes("--apply");
const FILE =
  process.argv.find((a) => a.endsWith(".json")) ??
  path.join(__dirname, "seed-messaging.local.json");

async function main() {
  const seed = JSON.parse(readFileSync(FILE, "utf8")) as SeedFile;
  if (!seed.tenantId || !seed.lang || !seed.createdByEmail) {
    throw new Error("seed file needs tenantId, lang, createdByEmail");
  }
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"} — tenant ${seed.tenantId}, lang ${seed.lang}, file ${FILE}`);

  // ── copy asset blocks ────────────────────────────────────────────────
  const store = assetStoreFor();
  const existingAssets = await store.loadAssets(seed.tenantId);
  for (const [kind, content] of Object.entries(seed.assets ?? {})) {
    if (!content?.trim()) continue;
    const current = existingAssets.find(
      (a) => a.isCurrent && a.campaignId === null && a.lang === seed.lang && a.kind === kind,
    );
    if (current && current.content.trim() === content.trim()) {
      console.log(`asset ${kind}: unchanged (v${current.version}) — skip`);
      continue;
    }
    console.log(`asset ${kind}: ${current ? `NEW VERSION over v${current.version}` : "CREATE v1"} (${content.trim().length} chars)`);
    if (APPLY) {
      await saveAssetVersion(
        store,
        { tenantId: seed.tenantId, campaignId: null, lang: seed.lang, kind: kind as AssetKind, content: content.trim() },
        () => crypto.randomUUID(),
      );
    }
  }

  // ── voice guide (optional) ───────────────────────────────────────────
  if (seed.voice) {
    const guides = await store.loadVoiceGuides(seed.tenantId);
    const cur = guides.find((g) => g.isCurrent && g.lang === seed.lang);
    const next = {
      bannedWords: seed.voice.bannedWords ?? [],
      favoredPhrasings: seed.voice.favoredPhrasings ?? [],
      formats: seed.voice.formats ?? [],
      frFormality: seed.voice.frFormality ?? ("vouvoiement" as const),
    };
    const same =
      cur &&
      JSON.stringify([cur.bannedWords, cur.favoredPhrasings, cur.formats, cur.frFormality]) ===
        JSON.stringify([next.bannedWords, next.favoredPhrasings, next.formats, next.frFormality]);
    if (same) {
      console.log(`voice guide: unchanged (v${cur.version}) — skip`);
    } else {
      console.log(`voice guide: ${cur ? `NEW VERSION over v${cur.version}` : "CREATE v1"}`);
      if (APPLY) {
        await saveVoiceGuideVersion(
          store,
          { tenantId: seed.tenantId, lang: seed.lang, topics: [], ...next },
          () => crypto.randomUUID(),
        );
      }
    }
  }

  // ── knowledge entries ────────────────────────────────────────────────
  const [creator] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, seed.createdByEmail))
    .limit(1);
  if (!creator) throw new Error(`no auth user with email ${seed.createdByEmail}`);

  for (const k of seed.knowledge ?? []) {
    if (!k.title?.trim() || !k.content?.trim()) continue;
    const contentHash = createHash("sha256").update(k.content.trim()).digest("hex");
    const [existing] = await db
      .select({ id: knowledgeEntries.id, contentHash: knowledgeEntries.contentHash })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.tenantId, seed.tenantId),
          eq(knowledgeEntries.title, k.title.trim()),
          eq(knowledgeEntries.isActive, true),
        ),
      )
      .limit(1);
    if (existing) {
      console.log(
        existing.contentHash === contentHash
          ? `kb "${k.title}": identical — skip`
          : `kb "${k.title}": EXISTS with different content — edit via /settings/knowledge (not overwritten)`,
      );
      continue;
    }
    console.log(`kb "${k.title}" [${k.category}]: CREATE (${k.content.trim().length} chars, stages [global])`);
    if (APPLY) {
      // Mirrors POST /api/settings/knowledge. stages ["global"] explicitly so
      // every entry reaches EVERY stage pull incl. the reply path's 'outreach'
      // (category "objections" alone derives [objections, cold_call] — which
      // the reply pull would NOT see).
      const [entry] = await db
        .insert(knowledgeEntries)
        .values({
          tenantId: seed.tenantId,
          createdBy: creator.id,
          scope: "workspace",
          title: k.title.trim(),
          category: (k.category || "custom").trim().toLowerCase().slice(0, 40),
          content: k.content.trim(),
          stages: ["global"],
          contentHash,
        })
        .returning();
      await embedKnowledgeEntry(seed.tenantId, entry.id, entry.title, entry.content).catch((e) =>
        console.warn(`kb "${k.title}": embedding failed (non-blocking):`, e),
      );
    }
  }

  console.log(APPLY ? "DONE — verify on /settings/knowledge and GET /api/copy/assets" : "DRY-RUN done — re-run with --apply to write");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
