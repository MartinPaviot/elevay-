/**
 * Enrich SIRENE-sourced French companies with a domain + firmographics
 * via Apollo — ONE org-search call each (cheapest op; no per-contact
 * calls). Apollo's FR hit rate is ~36-50%; misses keep their clean SIRENE
 * identity for a keyed FR provider later.
 *
 * THROTTLED: single-threaded with a delay (default ~46/min) + 429 backoff,
 * so it sustains under Apollo's rate limit instead of blowing through it.
 * Auto-stops if the rate limit is durably hit (avoids spinning on 429s).
 * Cost stays low (≈1 search credit per *successful* lookup; 429s are free).
 *
 * Usage: tsx scripts/enrich-sirene-apollo.ts <tenant> [cap] [delayMs]
 * (NODE_OPTIONS=--use-system-ca)
 */
import { db, companies } from "../src/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { searchOrganizations, isApolloAvailable } from "../src/lib/integrations/apollo-client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const tenantId = process.argv[2] ?? "47dca783-dac0-45a5-85cb-d217b2a3174d";
  const cap = Math.max(1, Math.min(2000, Number(process.argv[3] ?? 1200)));
  const delayMs = Math.max(200, Number(process.argv[4] ?? 1300));
  if (!isApolloAvailable()) { console.error("APOLLO_API_KEY not set"); process.exit(1); }

  const rows = await db
    .select({ id: companies.id, name: companies.name, properties: companies.properties })
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), isNull(companies.deletedAt), isNull(companies.domain), sql`${companies.properties}->>'source' = 'sirene'`))
    .limit(cap);

  console.log(`Apollo throttled enrich: ${rows.length} SIRENE companies @ ${Math.round(60000 / delayMs)}/min`);
  let enriched = 0, miss = 0, errors = 0, done = 0, consecutive429 = 0;

  for (const r of rows) {
    done++;
    if (!r.name) { miss++; continue; }
    await sleep(delayMs);
    try {
      const res = await searchOrganizations({ q_organization_name: r.name, organization_locations: ["France"], per_page: 1 });
      consecutive429 = 0;
      const org = res.organizations[0];
      const dom = org?.primary_domain ? org.primary_domain.toLowerCase().replace(/^www\./, "").trim() : null;
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
    } catch (e) {
      errors++;
      const msg = (e as Error).message ?? "";
      if (/429|rate|limit/i.test(msg)) {
        consecutive429++;
        await sleep(30_000); // back off on rate limit
        if (consecutive429 >= 10) {
          console.log(`Stopping early — Apollo rate limit durably hit after ${done} (enriched=${enriched}). Re-run later to continue.`);
          break;
        }
      }
    }
    if (done % 25 === 0) console.log(`  …${done}/${rows.length} enriched=${enriched} miss=${miss} err=${errors}`);
  }

  console.log(`Done: enriched=${enriched} miss=${miss} errors=${errors} processed=${done}/${rows.length}`);
  process.exit(0);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
