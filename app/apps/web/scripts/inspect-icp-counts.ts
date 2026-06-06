/**
 * Hard counts for the Pilae ICP cleanup decision:
 *  - country distribution
 *  - Swiss rows: what region/state/city do they carry (→ romand?)
 *  - size buckets via size column + employee_count + effectif_tranche
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle({ client, schema });

  const country = await db.execute(sql`
    SELECT COALESCE(properties->>'country','(none)') AS country, count(*)::int AS n
    FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
    GROUP BY 1 ORDER BY n DESC LIMIT 30
  `);
  console.log("=== country ===");
  for (const r of country as unknown as Array<{ country: string; n: number }>) console.log(`  ${r.country}: ${r.n}`);

  const swiss = await db.execute(sql`
    SELECT name,
      properties->>'region' AS region,
      properties->>'state' AS state,
      properties->>'city' AS city,
      properties->>'employee_count' AS emp,
      size
    FROM companies
    WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
      AND (properties->>'country') ILIKE ANY (ARRAY['%switz%','%suisse%','%schweiz%'])
    LIMIT 40
  `);
  console.log("\n=== Swiss rows (sample up to 40) ===");
  for (const r of swiss as unknown as Array<any>) {
    console.log(`  ${r.name} | region=${r.region ?? "-"} state=${r.state ?? "-"} city=${r.city ?? "-"} emp=${r.emp ?? "-"} size=${r.size ?? "-"}`);
  }

  // Best-effort numeric employee count: Apollo employee_count, else
  // parse the lower bound of effectif_tranche / size bracket isn't
  // trivial in SQL, so just bucket on employee_count where present.
  const sizeBuckets = await db.execute(sql`
    WITH e AS (
      SELECT
        CASE
          WHEN (properties->>'employee_count') ~ '^[0-9]+$'
            THEN (properties->>'employee_count')::int
          ELSE NULL
        END AS ec
      FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
    )
    SELECT
      count(*) FILTER (WHERE ec IS NULL)::int AS unknown_emp,
      count(*) FILTER (WHERE ec < 100)::int AS lt100,
      count(*) FILTER (WHERE ec >= 100 AND ec <= 1000)::int AS in_range,
      count(*) FILTER (WHERE ec > 1000)::int AS gt1000
    FROM e
  `);
  console.log("\n=== employee_count buckets (Apollo numeric only) ===");
  console.log(JSON.stringify((sizeBuckets as unknown as any[])[0], null, 2));

  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
