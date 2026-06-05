/** Confirm which tenant martin.paviot@pilae.ch resolves to. */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const DATA_TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle({ client, schema });

  const appUsers = await db.execute(sql`
    SELECT u.id, u.email, u.tenant_id, u.clerk_id, u.role, t.name AS tenant_name
    FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE lower(u.email) LIKE '%pilae%' OR lower(u.email) = 'martin.paviot@pilae.ch'
  `);
  console.log("=== app users (users table) matching pilae ===");
  for (const r of appUsers as unknown as Array<any>) {
    console.log(`  ${r.email} | tenant_id=${r.tenant_id} (${r.tenant_name}) | role=${r.role} | clerk_id=${r.clerk_id}`);
    console.log(`    -> ${r.tenant_id === DATA_TENANT ? "MATCHES data tenant 47dca783 ✓" : "DIFFERENT TENANT ✗"}`);
  }

  const authU = await db.execute(sql`
    SELECT id, email, (password_hash IS NOT NULL) AS has_pw FROM auth_users
    WHERE lower(email) LIKE '%pilae%'
  `);
  console.log("\n=== auth_users matching pilae ===");
  for (const r of authU as unknown as Array<any>) console.log(`  ${r.email} | id=${r.id} | has_password=${r.has_pw}`);

  // What's in the data tenant + who else points at it?
  const [{ cos, contacts }] = (await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM companies WHERE tenant_id=${DATA_TENANT} AND deleted_at IS NULL) AS cos,
      (SELECT count(*)::int FROM contacts WHERE tenant_id=${DATA_TENANT} AND deleted_at IS NULL) AS contacts
  `)) as unknown as Array<{ cos: number; contacts: number }>;
  console.log(`\nData tenant 47dca783: ${cos} live companies, ${contacts} live contacts`);

  const owners = await db.execute(sql`
    SELECT email, role FROM users WHERE tenant_id = ${DATA_TENANT}
  `);
  console.log("\nUsers in data tenant 47dca783:");
  for (const r of owners as unknown as Array<any>) console.log(`  ${r.email} | ${r.role}`);

  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
