/**
 * Source decision-maker contacts for enriched companies (domain present)
 * via Apollo people-search, using the ICP's target titles/seniorities.
 * Reuses the existing company-contact-finder skill. Inserts contacts
 * (name, title, email + email_status) deduped by email.
 *
 * Cost: ~1 Apollo people-search call per company. THROTTLED + capped.
 * Usage: tsx scripts/source-contacts.ts <tenant> "<ICP>" [cap] [delayMs]
 * (NODE_OPTIONS=--use-system-ca)
 */
import { db, companies, contacts, icps, icpCriteria } from "../src/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { companyContactFinderHandler } from "../src/skills/enrichment/company-contact-finder/handler";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function asArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)];
}

async function main() {
  const tenantId = process.argv[2] ?? "47dca783-dac0-45a5-85cb-d217b2a3174d";
  const icpName = process.argv[3] ?? "Scale-up Tech / SaaS B2B";
  const cap = Math.max(1, Math.min(2000, Number(process.argv[4] ?? 10)));
  const delayMs = Math.max(300, Number(process.argv[5] ?? 1300));

  const [icp] = await db.select({ id: icps.id }).from(icps).where(and(eq(icps.name, icpName), eq(icps.tenantId, tenantId))).limit(1);
  const critRows = icp ? await db.select().from(icpCriteria).where(eq(icpCriteria.icpId, icp.id)) : [];
  const titles = asArr(critRows.find((c) => c.fieldKey === "person_titles")?.value);
  const seniorities = asArr(critRows.find((c) => c.fieldKey === "person_seniorities")?.value)
    .map((s) => s.toLowerCase().replace(/[^a-z]/g, "_"));

  // Enriched companies with a domain but no contacts yet.
  const rows = await db
    .select({ id: companies.id, domain: companies.domain })
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), isNull(companies.deletedAt), sql`${companies.domain} IS NOT NULL`,
      sql`NOT EXISTS (SELECT 1 FROM contacts ct WHERE ct.company_id = ${companies.id})`))
    .limit(cap);

  console.log(`source-contacts: ${rows.length} companies, titles=[${titles.slice(0, 4).join(",")}…] @ ${Math.round(60000 / delayMs)}/min`);
  let withContacts = 0, inserted = 0, consecutive429 = 0;

  for (const r of rows) {
    if (!r.domain) continue;
    await sleep(delayMs);
    try {
      const res = await companyContactFinderHandler(
        { companyDomain: r.domain, targetTitles: titles.length ? titles : undefined, targetSeniorities: seniorities.length ? seniorities : ["c_suite", "vp", "director"], minResults: 1, maxResults: 3 },
        { tenantId, dryRun: false },
      );
      consecutive429 = 0;
      const found = res.contacts ?? [];
      if (found.length) withContacts++;
      for (const p of found) {
        // Insert the decision-maker even without an email (the email
        // REVEAL is a paid Apollo credit). Name+title+LinkedIn is already
        // actionable identity; email_status flags whether it's revealed.
        if (!p.name && !p.email && !p.linkedinUrl) continue;
        let exists: { id: string } | undefined;
        if (p.email) [exists] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.email, p.email)).limit(1);
        else if (p.linkedinUrl) [exists] = await db.select({ id: contacts.id }).from(contacts).where(sql`${contacts.properties}->>'linkedin_url' = ${p.linkedinUrl}`).limit(1);
        if (exists) continue;
        const parts = (p.name ?? "").split(" ");
        await db.insert(contacts).values({
          tenantId, companyId: r.id,
          firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") || null,
          email: p.email ?? null, title: p.title ?? null,
          properties: { enrichment_source: "apollo", seniority: p.seniority, linkedin_url: p.linkedinUrl, email_status: p.email ? "found" : "not_revealed", discovered_via: "source_contacts" },
        });
        inserted++;
      }
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (/429|rate|limit/i.test(msg)) {
        consecutive429++;
        await sleep(30_000);
        if (consecutive429 >= 8) { console.log(`Stopping early — Apollo rate limit (processed ${withContacts} with contacts).`); break; }
      }
    }
  }
  console.log(`Done: companies with contacts=${withContacts}, contacts inserted=${inserted}`);
  process.exit(0);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
