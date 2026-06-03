/**
 * Enrich SIRENE-sourced French companies with a domain + firmographics
 * via Apollo — ONE org-search call each (the cheapest op; no per-contact
 * people-search, to stay well under budget). Apollo's FR hit rate is ~36%
 * (measured); the misses keep their clean SIRENE identity and can be
 * enriched later by a keyed FR provider (FullEnrich/Zeliq).
 *
 * Cost: ~1 Apollo search credit per company. Hard-capped by [maxCompanies].
 *
 * Usage: tsx scripts/enrich-sirene-apollo.ts <tenant> [maxCompanies]
 * (NODE_OPTIONS=--use-system-ca for TLS)
 */
import { db, companies } from "../src/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { searchOrganizations, isApolloAvailable } from "../src/lib/integrations/apollo-client";

const CONCURRENCY = 5;

async function main() {
  const tenantId = process.argv[2] ?? "47dca783-dac0-45a5-85cb-d217b2a3174d";
  const cap = Math.max(1, Math.min(2000, Number(process.argv[3] ?? 1200)));
  if (!isApolloAvailable()) { console.error("APOLLO_API_KEY not set"); process.exit(1); }

  const rows = await db
    .select({ id: companies.id, name: companies.name, properties: companies.properties })
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), isNull(companies.deletedAt), isNull(companies.domain), sql`${companies.properties}->>'source' = 'sirene'`))
    .limit(cap);

  console.log(`Apollo domain-enrich: ${rows.length} SIRENE companies (cap ${cap})`);
  let enriched = 0, miss = 0, errors = 0, done = 0;

  async function worker(queue: typeof rows) {
    for (const r of queue) {
      done++;
      if (!r.name) { miss++; continue; }
      try {
        const res = await searchOrganizations({ q_organization_name: r.name, organization_locations: ["France"], per_page: 1 });
        const org = res.organizations[0];
        const dom = org?.primary_domain
          ? org.primary_domain.toLowerCase().replace(/^www\./, "").trim()
          : null;
        if (!dom) { miss++; }
        else {
          const props = (r.properties ?? {}) as Record<string, unknown>;
          await db.update(companies).set({
            domain: dom,
            industry: org.industry ?? null,
            properties: {
              ...props,
              apollo_org_id: org.id,
              apollo_enriched: true,
              employee_count: org.estimated_num_employees ?? null,
              technologies: org.technology_names ?? [],
              linkedin_url: org.linkedin_url ?? null,
              enrichment_source: [props.source, "apollo"].filter(Boolean).join("+"),
            },
            updatedAt: new Date(),
          }).where(eq(companies.id, r.id));
          enriched++;
        }
      } catch { errors++; }
      if (done % 50 === 0) console.log(`  …${done}/${rows.length} enriched=${enriched} miss=${miss} err=${errors}`);
    }
  }

  // Split into CONCURRENCY queues.
  const queues: (typeof rows)[] = Array.from({ length: CONCURRENCY }, () => []);
  rows.forEach((r, i) => queues[i % CONCURRENCY].push(r));
  await Promise.all(queues.map(worker));

  console.log(`Done: enriched(domain found)=${enriched} miss=${miss} errors=${errors} of ${rows.length}`);
  console.log(`Approx Apollo calls: ${rows.length} searches.`);
  process.exit(0);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
