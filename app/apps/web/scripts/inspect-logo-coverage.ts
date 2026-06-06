/**
 * One-off: how many companies in the Pilae tenant can show a REAL logo?
 * Breaks the 1701 down by domain presence, properties.logo_url (Apollo
 * tier-3), and any already-resolved logo. Tells us how much of the list
 * the V2 cascade lights up immediately vs. needs domain resolution.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";

async function main() {
  const url = process.env.DATABASE_URL!;
  const client = postgres(url);
  const db = drizzle({ client, schema });

  const [counts] = await db.execute(sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE domain IS NOT NULL AND domain <> '')::int AS with_domain,
      count(*) FILTER (WHERE (properties->>'logo_url') IS NOT NULL)::int AS with_logo_url,
      count(*) FILTER (WHERE resolved_logo_url IS NOT NULL)::int AS with_resolved
    FROM companies
    WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
  `) as unknown as Array<{ total: number; with_domain: number; with_logo_url: number; with_resolved: number }>;

  console.log("Pilae tenant company logo coverage:");
  console.log(JSON.stringify(counts, null, 2));

  // Sample a few no-domain rows so we see what they look like.
  const noDomain = await db.execute(sql`
    SELECT name, industry FROM companies
    WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
      AND (domain IS NULL OR domain = '')
    LIMIT 8
  `);
  console.log("\nSample no-domain companies:");
  for (const r of noDomain as unknown as Array<{ name: string; industry: string | null }>) {
    console.log(`  - ${r.name}  [${r.industry ?? "?"}]`);
  }

  // Sample a few WITH domain so we can eyeball whether V2 will resolve them.
  const withDomain = await db.execute(sql`
    SELECT name, domain FROM companies
    WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
      AND domain IS NOT NULL AND domain <> ''
    LIMIT 8
  `);
  console.log("\nSample with-domain companies:");
  for (const r of withDomain as unknown as Array<{ name: string; domain: string }>) {
    console.log(`  - ${r.name}  ->  ${r.domain}`);
  }

  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
