/**
 * Import the romand 100-1000 FTE Apollo pull into the Pilae tenant,
 * scored against the precise ICP (heuristic from SIC/NAICS + name, since
 * the lightweight search has no deep firmographics).
 *
 * Reads the saved Apollo search result files (pages 1-7), website-gates
 * (must have a valid domain), dedups vs every existing company in the
 * tenant (domain + apollo_org_id, incl. soft-deleted), classifies the
 * sector, and inserts with country=Switzerland / region=Suisse romande /
 * source=tam + a score_fit/grade/reasons in properties.
 *
 *   npx tsx --env-file=.env.local scripts/apply-apollo-import.ts          (dry-run)
 *   npx tsx --env-file=.env.local scripts/apply-apollo-import.ts --apply
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import * as schema from "../src/db/schema";
import { companies } from "../src/db/schema";

const TENANT = "47dca783-dac0-45a5-85cb-d217b2a3174d";
const RESULTS_DIR = "C:/Users/marti/.claude/projects/C--Users-marti-leads/c92d0c04-2021-436c-a2b3-6311db47b3c9/tool-results";

interface Org {
  id: string; name: string; primary_domain: string | null; website_url: string | null;
  logo_url: string | null; linkedin_url: string | null; founded_year: number | null;
  sic_codes?: string[]; naics_codes?: string[];
  organization_revenue?: number | null; organization_revenue_printed?: string | null;
}

function host(url: string | null): string | null {
  if (!url) return null;
  const m = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[\/?#]/)[0].trim().toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(m) ? m : null;
}
function domainOf(o: Org): string | null {
  const d = (o.primary_domain || "").trim().toLowerCase();
  if (d && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return d;
  return host(o.website_url);
}

const IGO_RE = /nations unies|united nations|\bonu\b|\boim\b|\bunhcr\b|\bhcr\b|unaids|unece|unctad|unitar|undrr|\bwto\b|\bomc\b|\bwmo\b|\bipcc\b|\bunep\b|interpol|world .*(council|organization|organisation)|organisation internationale|intergovernmental|\bwipo\b|\bilo\b|\bwho\b|\bitu\b/i;
const HEALTH_RE = /cabinet|cliniqu|h[oô]pital|h[oô]pitaux|m[ée]dical|m[ée]decin|pneumolog|neurolog|radiolog|sant[ée]|pharma|gen[ée]tic|diagnostic|dentaire|th[ée]rap/i;
const FOUND_RE = /fondation|foundation|association|f[ée]d[ée]ration|federation|\bngo\b|nonprofit|caritas|initiative|alliance|secours|croix-rouge/i;
const PUBLIC_RE = /[ée]cole|gymnase|coll[èe]ge|[ée]tablissement (primaire|scolaire|secondaire)|universit|institut|\bhes\b|\bheg\b|\bhep\b|canton|[ée]tat de|commune|municipalit|office cantonal|administration|arbeitslosenkasse|service public/i;
const LOWTECH_RE = /h[oô]tel|montre|horlog|watch|manufacture|usine|construction|b[âa]timent|transport|logistique|garage|restaurant|brasserie|imprimerie|[ée]ditions|m[ée]canic/i;
const FIN_RE = /\bbank\b|banque|capital|invest|gestion|holding|asset|wealth|patrimo|assurance|fiduciaire/i;
const TECH_RE = /software|\btech\b|digital|\bdata\b|cyber|cloud|\bai\b|crypto|\bcoin\b|blockchain|saas|informatique|num[ée]rique/i;

function sicAny(o: Org, prefixes: string[]): boolean {
  const codes = [...(o.sic_codes ?? []), ...(o.naics_codes ?? [])];
  return codes.some((c) => prefixes.some((p) => c.startsWith(p)));
}

function classify(o: Org): { score: number; grade: string; industry: string; reasons: string[] } {
  const n = o.name || "";
  const reasons: string[] = [];
  let score = 0.5, industry = "Autre";

  if (IGO_RE.test(n)) { score = 0.25; industry = "Organisation internationale"; reasons.push("IGO/ONU — faible fit GTM (IT propre, achats centralisés)"); }
  else if (HEALTH_RE.test(n) || sicAny(o, ["80"])) { score = 0.85; industry = "Santé"; reasons.push("Santé / données patients — priorité ICP forte"); }
  else if (PUBLIC_RE.test(n) || sicAny(o, ["82", "91", "92", "94", "9"])) { score = 0.8; industry = "Public / parapublic / éducation"; reasons.push("Parapublic / administration / éducation romande — priorité ICP"); }
  else if (FOUND_RE.test(n) || sicAny(o, ["8399", "8699", "8611", "6732", "8732"])) { score = 0.78; industry = "Fondation / ONG"; reasons.push("Fondation / association — priorité ICP (données donateurs)"); }
  else if (LOWTECH_RE.test(n) || sicAny(o, ["20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","15","16","17","70","75","42","44","45","50","51","52","53","54","55","56","57","58","59"])) { score = 0.7; industry = "Industrie / commerce / hospitalité"; reasons.push("Secteur peu-tech avec outils internes — bon fit"); }
  else if (FIN_RE.test(n) || sicAny(o, ["60","61","62","63","64","65","66","67"])) { score = 0.5; industry = "Finance / banque"; reasons.push("Finance — fit moyen (beaucoup d'outils, mais souvent IT établie)"); }
  else if (TECH_RE.test(n) || sicAny(o, ["737","357","367","481","489"]) || (o.naics_codes ?? []).some((c) => c.startsWith("5415"))) { score = 0.4; industry = "Tech / IT"; reasons.push("Tech/IT — anti-ICP léger (équipe IT déjà en place)"); }
  else { reasons.push("Secteur indéterminé (SIC/NAICS manquant)"); }

  const grade = score >= 0.75 ? "A" : score >= 0.6 ? "B" : score >= 0.45 ? "C" : "D";
  return { score, grade, industry, reasons };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle({ client, schema });

  // 1. Load all saved Apollo search result files.
  const files = readdirSync(RESULTS_DIR).filter((f) => f.includes("apollo_mixed_companies_search") && f.endsWith(".txt"));
  const orgsById = new Map<string, Org>();
  for (const f of files) {
    try {
      const json = JSON.parse(readFileSync(join(RESULTS_DIR, f), "utf8"));
      for (const o of (json.organizations ?? []) as Org[]) orgsById.set(o.id, o);
    } catch (e) { console.warn(`skip ${f}: ${(e as Error).message}`); }
  }
  console.log(`Read ${files.length} files -> ${orgsById.size} unique orgs`);

  // 2. Existing dedup keys (domain + apollo_org_id), incl. soft-deleted.
  const existing = (await db.execute(sql`
    SELECT lower(domain) AS domain, properties->>'apollo_org_id' AS aid, properties->>'apollo_id' AS aid2
    FROM companies WHERE tenant_id = ${TENANT}
  `)) as unknown as Array<{ domain: string | null; aid: string | null; aid2: string | null }>;
  const haveDomain = new Set(existing.map((r) => r.domain).filter(Boolean));
  const haveAid = new Set<string>();
  for (const r of existing) { if (r.aid) haveAid.add(r.aid); if (r.aid2) haveAid.add(r.aid2); }

  // 3. Build insert rows.
  const rows: any[] = [];
  const counts = { noDomain: 0, dupDomain: 0, dupAid: 0, byGrade: { A: 0, B: 0, C: 0, D: 0 } as Record<string, number> };
  const seenDomain = new Set<string>();
  for (const o of orgsById.values()) {
    if (haveAid.has(o.id)) { counts.dupAid++; continue; }
    const domain = domainOf(o);
    if (!domain) { counts.noDomain++; continue; }
    if (haveDomain.has(domain) || seenDomain.has(domain)) { counts.dupDomain++; continue; }
    seenDomain.add(domain);
    const c = classify(o);
    counts.byGrade[c.grade]++;
    rows.push({
      tenantId: TENANT,
      name: o.name,
      domain,
      industry: c.industry,
      size: "100-1000",
      revenue: o.organization_revenue_printed ?? null,
      score: c.score,
      properties: {
        country: "Switzerland", region: "Suisse romande", source: "tam",
        search_strategy: "Pilae ICP romand 100-1000",
        apollo_org_id: o.id, logo_url: o.logo_url ?? null, linkedin_url: o.linkedin_url ?? null,
        founded_year: o.founded_year ?? null, sic_codes: o.sic_codes ?? [], naics_codes: o.naics_codes ?? [],
        annual_revenue: o.organization_revenue ?? null, employee_band: "100-1000",
        score_fit: Math.round(c.score * 100), score_grade: c.grade, score_fit_reasons: c.reasons,
        score_source: "pilae-sic-heuristic",
      },
    });
  }

  console.log(`\nCandidates: ${orgsById.size}`);
  console.log(`  dropped no-domain (website gate): ${counts.noDomain}`);
  console.log(`  skipped dup (apollo_id): ${counts.dupAid}   dup (domain): ${counts.dupDomain}`);
  console.log(`  -> NET NEW to insert: ${rows.length}`);
  console.log(`  grade: A=${counts.byGrade.A} B=${counts.byGrade.B} C=${counts.byGrade.C} D=${counts.byGrade.D}`);
  console.log("\nTop sample (grade A):");
  for (const r of rows.filter((x) => x.properties.score_grade === "A").slice(0, 12)) console.log(`  ${r.name} | ${r.domain} | ${r.industry}`);

  if (!apply) { console.log("\n(dry-run — pass --apply to insert)"); await client.end(); return; }

  for (let i = 0; i < rows.length; i += 100) await db.insert(companies).values(rows.slice(i, i + 100));
  const [{ live }] = (await db.execute(sql`SELECT count(*)::int AS live FROM companies WHERE tenant_id = ${TENANT} AND deleted_at IS NULL`)) as unknown as Array<{ live: number }>;
  console.log(`\nAPPLIED: inserted ${rows.length}. Live companies now: ${live}`);
  await client.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
