/**
 * Decisive test for the "UI shows 0 criteria but DB has 8" bug.
 * Reconstructs the EXACT drizzle query GET /api/icps runs, prints the
 * generated SQL, and executes it on DATABASE_URL. Also prints the db
 * identity so we can tell whether the dev server is bound elsewhere.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { icps } from "../src/db/schema";

const TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";

async function main() {
  const url = process.env.DATABASE_URL!;
  const host = url.replace(/^.*@/, "").replace(/\/.*$/, "");
  const client = postgres(url);
  const db = drizzle({ client, schema });

  const ident = await client`SELECT current_database() AS db, current_user AS usr`;
  console.log(`connected db=${ident[0].db} user=${ident[0].usr} host=${host}`);

  const q = db
    .select({
      id: icps.id,
      name: icps.name,
      criteriaCount: sql<number>`(SELECT count(*)::int FROM icp_criteria WHERE icp_criteria.icp_id = "icps"."id")`,
      fitCount: sql<number>`(SELECT count(*)::int FROM company_icp_fit WHERE company_icp_fit.icp_id = "icps"."id" AND company_icp_fit.fit_score >= 0.5)`,
    })
    .from(icps)
    .where(eq(icps.tenantId, TENANT))
    .orderBy(icps.priority, icps.createdAt);

  console.log("\n--- generated SQL ---");
  console.log(q.toSQL().sql);
  console.log("params:", JSON.stringify(q.toSQL().params));

  const rows = await q;
  console.log("\n--- result (drizzle, same DATABASE_URL the app uses) ---");
  for (const r of rows) console.log(`  ${r.name}: criteriaCount=${r.criteriaCount} fitCount=${r.fitCount}`);

  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
