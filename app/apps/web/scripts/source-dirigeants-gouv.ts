/**
 * Enrich SIRENE companies with their DIRIGEANTS (decision-maker names +
 * roles: Président, DG, Gérant…) and financials, from the keyless gouv
 * API. Free — no token, no reveal cost. Dirigeants have no email (the
 * registry has none) but give the AE the real person to ask for; email
 * comes from a later (paid) reveal/enrichment.
 *
 * Usage: tsx scripts/source-dirigeants-gouv.ts <tenant> [cap] [delayMs]
 * (NODE_OPTIONS=--use-system-ca)
 */
import { db, companies, contacts } from "../src/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { companyDetailBySiren } from "../src/lib/integrations/recherche-entreprises-client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RELEVANT = /président|directeur|gérant|gerant|pdg|associé|associe|cofondateur|fondateur|dirigeant/i;

async function main() {
  const tenantId = process.argv[2] ?? "47dca783-dac0-45a5-85cb-d217b2a3174d";
  const cap = Math.max(1, Math.min(2000, Number(process.argv[3] ?? 1200)));
  const delayMs = Math.max(120, Number(process.argv[4] ?? 220));

  const rows = await db
    .select({ id: companies.id, properties: companies.properties })
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), isNull(companies.deletedAt), sql`${companies.properties}->>'source' = 'sirene'`))
    .limit(cap);

  console.log(`dirigeants enrich: ${rows.length} SIRENE companies @ ${Math.round(1000 / delayMs)}/s (keyless, free)`);
  let withDir = 0, contactsInserted = 0, withFin = 0, done = 0;

  for (const r of rows) {
    done++;
    const props = (r.properties ?? {}) as Record<string, unknown>;
    const siren = props.siren as string | undefined;
    if (!siren) continue;
    await sleep(delayMs);
    try {
      const detail = await companyDetailBySiren(siren);
      if (!detail) continue;

      // Financials → company properties.
      if (detail.ca != null || detail.resultatNet != null) {
        withFin++;
        await db.update(companies).set({
          properties: { ...props, ca: detail.ca, resultat_net: detail.resultatNet, finances_year: detail.year },
          updatedAt: new Date(),
        }).where(eq(companies.id, r.id));
      }

      // Dirigeants (decision-makers) → contacts. Persons in a relevant role, cap 3.
      const picks = detail.dirigeants.filter((d) => d.isPerson && d.role && RELEVANT.test(d.role)).slice(0, 3);
      if (picks.length) withDir++;
      for (const d of picks) {
        const [exists] = await db.select({ id: contacts.id }).from(contacts)
          .where(and(eq(contacts.tenantId, tenantId), eq(contacts.companyId, r.id),
            sql`lower(coalesce(last_name,'')) = ${(d.lastName ?? "").toLowerCase()}`)).limit(1);
        if (exists) continue;
        await db.insert(contacts).values({
          tenantId, companyId: r.id,
          firstName: d.firstName, lastName: d.lastName, email: null,
          title: d.role,
          properties: { enrichment_source: "rne_gouv", role: d.role, email_status: "not_revealed", discovered_via: "dirigeants" },
        });
        contactsInserted++;
      }
    } catch { /* skip on transient error */ }
    if (done % 50 === 0) console.log(`  …${done}/${rows.length} withDir=${withDir} contacts=${contactsInserted} withFin=${withFin}`);
  }
  console.log(`Done: companies with dirigeants=${withDir}, contacts inserted=${contactsInserted}, with financials=${withFin}`);
  process.exit(0);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
