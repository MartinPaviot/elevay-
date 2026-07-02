/**
 * One-shot cleanup: remove the garbage funding/acquisition signals the OLD
 * news-derived detector wrote into companies.properties.signals[] before it was
 * cut (fix/signal-news-funding). Those fired on bare-name Google-News matches
 * ("Arcadia" → "Arcadia Biosciences Raises $4M") and keyword false positives
 * ("government funding", "Climate Voices series"), plus Apollo funding_recent
 * that were first-sight false-"new".
 *
 * Removal rule (KEEP everything else — hiring, warm_connection, and honest
 * Apollo steady-state `funding`):
 *   - type = funding_recent        → REMOVE ALL (news garbage + apollo first-sight;
 *                                     the corrected monitors only re-emit it on a
 *                                     real observed increase)
 *   - type = acquisition           → REMOVE ALL (only the news detector wrote it)
 *   - type = funding, source≠apollo → REMOVE (news-sourced; keep source=apollo)
 *
 * Usage:
 *   DATABASE_URL=... tsx scripts/purge-news-funding-signals.ts <tenantId|ALL> [--apply]
 * Dry-run by default; prints per-tenant before/after counts.
 */

import postgres from "postgres";

interface SignalEntry {
  type?: unknown;
  source?: unknown;
  [k: string]: unknown;
}

/** True when the entry is news-derived funding/acquisition garbage to drop. */
export function isPurgeableFundingSignal(entry: SignalEntry): boolean {
  const type = typeof entry?.type === "string" ? entry.type : "";
  if (type === "funding_recent") return true;
  if (type === "acquisition") return true;
  if (type === "funding" && entry?.source !== "apollo") return true;
  return false;
}

async function main() {
  const arg = process.argv[2];
  const apply = process.argv.includes("--apply");
  const url = process.env.DATABASE_URL;
  if (!arg || !url) {
    console.error("usage: DATABASE_URL=... tsx scripts/purge-news-funding-signals.ts <tenantId|ALL> [--apply]");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });

  const tenantFilter = arg === "ALL" ? sql`` : sql`AND c.tenant_id = ${arg}`;
  const rows = await sql`
    SELECT c.id, c.tenant_id, c.name, c.properties
    FROM companies c
    WHERE c.deleted_at IS NULL
      AND jsonb_array_length(coalesce(c.properties->'signals', '[]'::jsonb)) > 0
      ${tenantFilter}
  `;

  let scanned = 0;
  let touched = 0;
  const removedByKind: Record<string, number> = {};

  for (const r of rows) {
    scanned++;
    const props = (r.properties ?? {}) as Record<string, unknown>;
    const signals = Array.isArray(props.signals) ? (props.signals as SignalEntry[]) : [];
    const kept: SignalEntry[] = [];
    let removedHere = 0;
    for (const s of signals) {
      if (isPurgeableFundingSignal(s)) {
        const kind = `${typeof s.type === "string" ? s.type : "?"}${s.source === "apollo" ? " (apollo)" : " (news)"}`;
        removedByKind[kind] = (removedByKind[kind] ?? 0) + 1;
        removedHere++;
      } else {
        kept.push(s);
      }
    }
    if (removedHere > 0) {
      touched++;
      if (apply) {
        await sql`
          UPDATE companies
          SET properties = ${JSON.stringify({ ...props, signals: kept })}::jsonb
          WHERE id = ${r.id as string}
        `;
      } else {
        console.log(`  [dry] ${r.name}: -${removedHere} (kept ${kept.length})`);
      }
    }
  }

  console.log(JSON.stringify({ mode: apply ? "APPLIED" : "DRY-RUN", scanned, companiesTouched: touched, removedByKind }, null, 2));
  await sql.end();
}

// Only run when invoked directly (tsx/node) — importing the module for the
// unit test of isPurgeableFundingSignal must NOT open a DB connection.
if (process.argv[1]?.includes("purge-news-funding-signals")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
