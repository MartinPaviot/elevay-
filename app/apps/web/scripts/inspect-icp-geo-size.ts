/**
 * What geo/size data do the Pilae-tenant companies actually carry?
 * Drives the ICP cleanup: we can only hard-filter on fields that exist.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle({ client, schema });

  // 1. Distinct top-level property keys + how many rows have each.
  const keys = await db.execute(sql`
    SELECT k AS key, count(*)::int AS n
    FROM companies, jsonb_object_keys(properties) AS k
    WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
    GROUP BY k ORDER BY n DESC
  `);
  console.log("=== property keys (key: rows) ===");
  for (const r of keys as unknown as Array<{ key: string; n: number }>) {
    console.log(`  ${r.key}: ${r.n}`);
  }

  // 2. Size column distribution.
  const sizes = await db.execute(sql`
    SELECT COALESCE(size,'(null)') AS size, count(*)::int AS n
    FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
    GROUP BY size ORDER BY n DESC LIMIT 40
  `);
  console.log("\n=== size column distribution ===");
  for (const r of sizes as unknown as Array<{ size: string; n: number }>) {
    console.log(`  ${r.size}: ${r.n}`);
  }

  // 3. Sample 6 full rows so we can read the actual property shapes.
  const sample = await db.execute(sql`
    SELECT name, domain, size, industry, properties
    FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL
    ORDER BY random() LIMIT 6
  `);
  console.log("\n=== sample rows ===");
  for (const r of sample as unknown as Array<{ name: string; domain: string | null; size: string | null; industry: string | null; properties: Record<string, unknown> }>) {
    console.log(`\n- ${r.name} | domain=${r.domain ?? "-"} | size=${r.size ?? "-"} | industry=${r.industry ?? "-"}`);
    console.log(`  props=${JSON.stringify(r.properties)}`);
  }

  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
