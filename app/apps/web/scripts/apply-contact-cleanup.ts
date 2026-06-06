/**
 * Contact cleanup: the contacts are stale old-TAM/seed records (446 of
 * 519 sit on now-deleted companies). Per Martin: clean the out-of-date
 * ones, "laissant simplement un exemple" -> keep ONE good example
 * contact, soft-delete the rest. Reversible (sets deleted_at).
 *
 * The example kept = best contact on a LIVE company, preferring
 * Switzerland/romand, with a real email + title + name.
 *
 *   npx tsx --env-file=.env.local scripts/apply-contact-cleanup.ts          (dry-run)
 *   npx tsx --env-file=.env.local scripts/apply-contact-cleanup.ts --apply
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql, inArray, ne } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { contacts } from "../src/db/schema";

const TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";
const ROMAND_RE = /geneva|gen[eè]ve|vaud|neuch|valais|wallis|fribourg|freiburg|jura/i;

type Row = {
  id: string; first_name: string | null; last_name: string | null;
  email: string | null; title: string | null; company: string | null;
  company_live: boolean; country: string | null; state: string | null;
};

function score(r: Row): number {
  let s = 0;
  if (r.company_live) s += 4;
  if ((r.country || "").toLowerCase().includes("switz")) s += 3;
  if (r.state && ROMAND_RE.test(r.state)) s += 2;
  if (r.email && /@/.test(r.email)) s += 3;
  if (r.title) s += 1;
  if (r.first_name && r.last_name) s += 1;
  return s;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle({ client, schema });

  const rows = (await db.execute(sql`
    SELECT c.id, c.first_name, c.last_name, c.email, c.title,
      comp.name AS company, (comp.id IS NOT NULL AND comp.deleted_at IS NULL) AS company_live,
      comp.properties->>'country' AS country, comp.properties->>'state' AS state
    FROM contacts c LEFT JOIN companies comp ON comp.id = c.company_id
    WHERE c.tenant_id = ${TENANT} AND c.deleted_at IS NULL
  `)) as unknown as Row[];

  if (rows.length === 0) { console.log("No live contacts."); await client.end(); return; }

  const best = rows.slice().sort((a, b) => score(b) - score(a))[0];
  console.log(`Live contacts: ${rows.length}`);
  console.log(`\nKEEPING example (score ${score(best)}):`);
  console.log(`  ${best.first_name ?? ""} ${best.last_name ?? ""} | ${best.email ?? "-"} | ${best.title ?? "-"} | ${best.company ?? "(no company)"} | ${best.country ?? "-"}/${best.state ?? "-"}`);
  console.log(`\nWould soft-delete: ${rows.length - 1}`);

  if (!apply) { console.log("\n(dry-run — pass --apply to keep only the example)"); await client.end(); return; }

  const now = new Date();
  const ids = rows.filter((r) => r.id !== best.id).map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    await db.update(contacts).set({ deletedAt: now }).where(inArray(contacts.id, ids.slice(i, i + 200)));
  }
  const [{ live }] = (await db.execute(sql`
    SELECT count(*)::int AS live FROM contacts WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
  `)) as unknown as Array<{ live: number }>;
  console.log(`\nAPPLIED: soft-deleted ${ids.length}. Remaining live contacts: ${live}`);
  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
