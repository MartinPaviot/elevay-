/**
 * Pilae ICP cleanup (decision: Romand + France >=100 FTE).
 *
 * KEEP:
 *   - Suisse romande (VD/GE/NE/FR/VS/JU), any size.
 *   - France with confirmed 100-1000 FTE.
 * SOFT-DELETE (reversible: sets deleted_at) everything else:
 *   - France <100 FTE, >1000 FTE, or size unconfirmable.
 *   - Suisse alemanique (non-romand), other countries, demo/junk (no country).
 *
 * Dry-run by default (prints counts). Pass `--apply` to soft-delete.
 *   npx tsx --env-file=.env.local scripts/apply-icp-cleanup.ts
 *   npx tsx --env-file=.env.local scripts/apply-icp-cleanup.ts --apply
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql, inArray, eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { companies } from "../src/db/schema";

const TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";
const ROMAND_RE = /geneva|gen[eè]ve|vaud|neuch|valais|wallis|fribourg|freiburg|jura/i;

// SIRENE tranche d'effectif salarie -> [low, high]. Only the lower bound
// is used for the >=100 / <=1000 test.
const SIRENE_BANDS: Record<string, [number, number]> = {
  "00": [0, 0], "01": [1, 2], "02": [3, 5], "03": [6, 9],
  "11": [10, 19], "12": [20, 49], "21": [50, 99], "22": [100, 199],
  "31": [200, 249], "32": [250, 499], "41": [500, 999], "42": [1000, 1999],
  "51": [2000, 4999], "52": [5000, 9999], "53": [10000, 99999],
};

type Row = {
  id: string;
  country: string | null;
  state: string | null;
  effectif: string | null;
  emp: string | null;
};

function fteLow(r: Row): number | null {
  if (r.effectif && SIRENE_BANDS[r.effectif]) return SIRENE_BANDS[r.effectif][0];
  if (r.emp && /^[0-9]+$/.test(r.emp)) return parseInt(r.emp, 10);
  return null;
}

function classify(r: Row): { keep: boolean; reason: string } {
  const country = (r.country || "").toLowerCase();
  const isSwiss = country.includes("switz") || country.includes("suisse") || country.includes("schweiz");
  const isFrance = country === "france";

  if (isSwiss) {
    if (r.state && ROMAND_RE.test(r.state)) return { keep: true, reason: "keep: romande" };
    return { keep: false, reason: "drop: suisse alemanique" };
  }
  if (isFrance) {
    const low = fteLow(r);
    if (low === null) return { keep: false, reason: "drop: FR taille inconnue" };
    if (low < 100) return { keep: false, reason: "drop: FR <100 FTE" };
    if (low > 1000) return { keep: false, reason: "drop: FR >1000 FTE" };
    return { keep: true, reason: "keep: FR 100-1000 FTE" };
  }
  if (!country) return { keep: false, reason: "drop: demo/junk (no country)" };
  return { keep: false, reason: "drop: autre pays" };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle({ client, schema });

  const rows = (await db.execute(sql`
    SELECT id,
      properties->>'country' AS country,
      properties->>'state' AS state,
      properties->>'effectif_tranche' AS effectif,
      properties->>'employee_count' AS emp
    FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
  `)) as unknown as Row[];

  const counts: Record<string, number> = {};
  const toDelete: string[] = [];
  let keepN = 0;
  for (const r of rows) {
    const { keep, reason } = classify(r);
    counts[reason] = (counts[reason] || 0) + 1;
    if (keep) keepN++;
    else toDelete.push(r.id);
  }

  console.log(`Total live: ${rows.length}`);
  console.log(`KEEP: ${keepN}   DELETE: ${toDelete.length}`);
  console.log("\nBy reason:");
  for (const [reason, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${n}`);
  }

  if (!apply) {
    console.log("\n(dry-run — pass --apply to soft-delete the DELETE set)");
    await client.end();
    return;
  }

  const now = new Date();
  let done = 0;
  for (let i = 0; i < toDelete.length; i += 200) {
    const chunk = toDelete.slice(i, i + 200);
    await db.update(companies).set({ deletedAt: now }).where(inArray(companies.id, chunk));
    done += chunk.length;
  }
  console.log(`\nAPPLIED: soft-deleted ${done} companies (deleted_at set).`);

  const [{ live }] = (await db.execute(sql`
    SELECT count(*)::int AS live FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
  `)) as unknown as Array<{ live: number }>;
  console.log(`Remaining live in tenant: ${live}`);
  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
