/**
 * Website gate: an account with no valid website is useless. Soft-delete
 * every LIVE company in the Pilae tenant whose domain is missing/empty/
 * malformed. Reversible (sets deleted_at). Dry-run by default; --apply to act.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql, inArray } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { companies } from "../src/db/schema";

const TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";

function validDomain(d: string | null): boolean {
  if (!d) return false;
  const s = d.trim().toLowerCase();
  if (!s) return false;
  // must look like a domain: at least one dot, a TLD, no spaces
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle({ client, schema });

  const rows = (await db.execute(sql`
    SELECT id, name, domain, properties->>'country' AS country, properties->>'source' AS source
    FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
  `)) as unknown as Array<{ id: string; name: string; domain: string | null; country: string | null; source: string | null }>;

  const keep: typeof rows = [];
  const drop: typeof rows = [];
  for (const r of rows) (validDomain(r.domain) ? keep : drop).push(r);

  console.log(`Live: ${rows.length}  ->  KEEP (valid website): ${keep.length}   DROP (no/invalid website): ${drop.length}`);

  // Breakdown of dropped by source + country.
  const by: Record<string, number> = {};
  for (const r of drop) {
    const k = `${r.source ?? "?"} / ${r.country ?? "?"}`;
    by[k] = (by[k] || 0) + 1;
  }
  console.log("\nDropped by source/country:");
  for (const [k, n] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`);

  console.log("\nSample of KEEP (valid website):");
  for (const r of keep.slice(0, 12)) console.log(`  ${r.name} -> ${r.domain}`);

  if (!apply) {
    console.log("\n(dry-run — pass --apply to soft-delete the no-website set)");
    await client.end();
    return;
  }

  const ids = drop.map((r) => r.id);
  const now = new Date();
  for (let i = 0; i < ids.length; i += 200) {
    await db.update(companies).set({ deletedAt: now }).where(inArray(companies.id, ids.slice(i, i + 200)));
  }
  const [{ live }] = (await db.execute(sql`
    SELECT count(*)::int AS live FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
  `)) as unknown as Array<{ live: number }>;
  console.log(`\nAPPLIED: soft-deleted ${ids.length}. Remaining live: ${live}`);
  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
