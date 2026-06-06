import postgres from "postgres";
async function main() {
  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  await s`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "resolved_logo_url" text`;
  await s`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "resolved_logo_tier" integer`;
  await s`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "logo_resolved_at" timestamp with time zone`;
  await s`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "user_uploaded_logo_url" text`;
  await s`CREATE INDEX IF NOT EXISTS "companies_logo_resolved_at_idx" ON "companies" USING btree ("logo_resolved_at")`;
  console.log("0027 logo columns applied (idempotent).");

  // Drift gauge: what does the tracking table know about?
  try {
    const rows = await s`SELECT count(*)::int n FROM __drizzle_migrations`;
    console.log(`__drizzle_migrations recorded: ${rows[0].n}`);
  } catch {
    console.log("__drizzle_migrations table absent — DB migrated outside the runner.");
  }
  await s.end();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
