import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";
const ROMAND_RE = "geneva|gen[èe]ve|vaud|neuch|valais|wallis|fribourg|freiburg|jura";

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle({ client, schema });

  // Swiss romand: by canton (state), with size buckets from employee_count.
  const romand = await db.execute(sql`
    WITH s AS (
      SELECT properties->>'state' AS canton,
        CASE WHEN (properties->>'employee_count') ~ '^[0-9]+$' THEN (properties->>'employee_count')::int ELSE NULL END AS ec
      FROM companies
      WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
        AND (properties->>'country') ILIKE '%switz%'
        AND (properties->>'state') ~* ${ROMAND_RE}
    )
    SELECT
      count(*)::int AS romand_total,
      count(*) FILTER (WHERE ec >= 100 AND ec <= 1000)::int AS in_range,
      count(*) FILTER (WHERE ec < 100)::int AS lt100,
      count(*) FILTER (WHERE ec IS NULL)::int AS unknown,
      count(*) FILTER (WHERE ec > 1000)::int AS gt1000
    FROM s
  `);
  console.log("=== Swiss ROMAND (GE/VD/NE/VS/FR/JU) ===");
  console.log(JSON.stringify((romand as unknown as any[])[0], null, 2));

  // Swiss non-romand (would be removed even in romand-only mode).
  const nonRomand = await db.execute(sql`
    SELECT properties->>'state' AS canton, count(*)::int AS n
    FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
      AND (properties->>'country') ILIKE '%switz%'
      AND ((properties->>'state') IS NULL OR NOT ((properties->>'state') ~* ${ROMAND_RE}))
    GROUP BY 1 ORDER BY n DESC
  `);
  console.log("\n=== Swiss NON-romand cantons ===");
  for (const r of nonRomand as unknown as Array<{ canton: string; n: number }>) console.log(`  ${r.canton ?? "(null)"}: ${r.n}`);

  // What are the country=(none) rows? Possibly the Zefix CH import.
  const none = await db.execute(sql`
    SELECT name, properties->>'source' AS src, properties->>'city' AS city, properties->>'region' AS region, properties->>'state' AS state
    FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
      AND (properties->>'country') IS NULL
    LIMIT 15
  `);
  console.log("\n=== country=(none) sample ===");
  for (const r of none as unknown as Array<any>) console.log(`  ${r.name} | src=${r.src ?? "-"} city=${r.city ?? "-"} region=${r.region ?? "-"} state=${r.state ?? "-"}`);

  // France size buckets (effectif_tranche is a SIRENE code; show its spread).
  const frEff = await db.execute(sql`
    SELECT COALESCE(properties->>'effectif_tranche','(none)') AS tr, count(*)::int AS n
    FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
      AND (properties->>'country') = 'France'
    GROUP BY 1 ORDER BY n DESC LIMIT 25
  `);
  console.log("\n=== France effectif_tranche spread (SIRENE code) ===");
  for (const r of frEff as unknown as Array<{ tr: string; n: number }>) console.log(`  ${r.tr}: ${r.n}`);

  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
