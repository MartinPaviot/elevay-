/**
 * Cost probe: measure Apollo's domain hit-rate on SIRENE-sourced French
 * companies (name → domain via Apollo org search). ~25 calls. Decides
 * whether bulk Apollo enrichment is worth it for FR SMEs before spending.
 */
import { db, companies } from "../src/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { searchOrganizations, isApolloAvailable } from "../src/lib/integrations/apollo-client";

async function main() {
  const t = process.argv[2] ?? "47dca783-dac0-45a5-85cb-d217b2a3174d";
  const n = Math.min(40, Number(process.argv[3] ?? 25));
  if (!isApolloAvailable()) { console.error("APOLLO_API_KEY not set"); process.exit(1); }

  const rows = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(and(eq(companies.tenantId, t), isNull(companies.domain), sql`${companies.properties}->>'source' = 'sirene'`))
    .limit(n);

  let hit = 0;
  for (const r of rows) {
    if (!r.name) continue;
    let dom: string | null = null;
    try {
      const res = await searchOrganizations({ q_organization_name: r.name, organization_locations: ["France"], per_page: 1 });
      dom = res.organizations[0]?.primary_domain ?? null;
    } catch (e) {
      console.log(`  ERR ${r.name}: ${(e as Error).message}`);
    }
    if (dom) hit++;
    console.log(`${dom ? "OK " : "-- "} ${String(r.name).slice(0, 34).padEnd(34)} -> ${dom ?? "(no match)"}`);
  }
  console.log(`\nApollo FR domain hit rate: ${hit}/${rows.length} (${rows.length ? Math.round((100 * hit) / rows.length) : 0}%)`);
  process.exit(0);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
