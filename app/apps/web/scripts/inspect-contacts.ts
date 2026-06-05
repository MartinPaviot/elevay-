/**
 * Inspect contacts in the Pilae tenant ahead of a cleanup: how many,
 * how many are tied to a LIVE company vs a soft-deleted one vs none,
 * and what the data looks like (to judge "no longer up to date").
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle({ client, schema });

  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'contacts' ORDER BY ordinal_position
  `);
  console.log("contacts columns:", (cols as unknown as Array<{ column_name: string }>).map((c) => c.column_name).join(", "));

  const [tot] = (await db.execute(sql`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS soft_deleted
    FROM contacts WHERE tenant_id = ${TENANT}
  `)) as unknown as Array<{ total: number; soft_deleted: number }>;
  console.log(`\nContacts total=${tot.total} (already soft-deleted=${tot.soft_deleted})`);

  const [bd] = (await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE comp.id IS NOT NULL AND comp.deleted_at IS NULL)::int AS on_live_company,
      count(*) FILTER (WHERE comp.id IS NOT NULL AND comp.deleted_at IS NOT NULL)::int AS on_deleted_company,
      count(*) FILTER (WHERE c.company_id IS NULL)::int AS no_company,
      count(*) FILTER (WHERE c.company_id IS NOT NULL AND comp.id IS NULL)::int AS dangling_company
    FROM contacts c
    LEFT JOIN companies comp ON comp.id = c.company_id
    WHERE c.tenant_id = ${TENANT} AND c.deleted_at IS NULL
  `)) as unknown as Array<Record<string, number>>;
  console.log("\nLive contacts by company status:");
  console.log(JSON.stringify(bd, null, 2));

  const sample = await db.execute(sql`
    SELECT c.first_name, c.last_name, c.email, c.title, comp.name AS company,
      (comp.deleted_at IS NOT NULL) AS company_deleted, c.created_at
    FROM contacts c LEFT JOIN companies comp ON comp.id = c.company_id
    WHERE c.tenant_id = ${TENANT} AND c.deleted_at IS NULL
    ORDER BY random() LIMIT 12
  `);
  console.log("\nSample contacts:");
  for (const r of sample as unknown as Array<any>) {
    console.log(`  ${r.first_name ?? ""} ${r.last_name ?? ""} | ${r.email ?? "-"} | ${r.title ?? "-"} | ${r.company ?? "(no company)"}${r.company_deleted ? " [DELETED]" : ""}`);
  }

  // Of contacts on LIVE companies, how many live companies have >=1 contact?
  const [liveCos] = (await db.execute(sql`
    SELECT count(DISTINCT c.company_id)::int AS live_cos_with_contacts
    FROM contacts c JOIN companies comp ON comp.id = c.company_id
    WHERE c.tenant_id = ${TENANT} AND c.deleted_at IS NULL AND comp.deleted_at IS NULL
  `)) as unknown as Array<{ live_cos_with_contacts: number }>;
  console.log(`\nLive companies that have >=1 live contact: ${liveCos.live_cos_with_contacts}`);

  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
