/**
 * Print the SPF/DKIM/DMARC authentication verdict for a tenant's sending
 * domains — the operator's hardening checklist for owner-SMTP cold sending.
 *
 * Reuses the SAME grader the autopilot capacity gate uses (`dnsAuthLookup` +
 * `verifyAuth`, spec-21 AC2): a domain is `sendable` only with SPF enforcing
 * (`~all`/`-all`), DKIM present at >= 2048-bit, AND DMARC enforcing
 * (`quarantine`/`reject`). So what this prints is exactly what the capacity
 * source will see once the boxes are converted to owner-SMTP.
 *
 *   tsx scripts/verify-sending-domains.ts              # all domains for the tenant
 *   tsx scripts/verify-sending-domains.ts a.com b.com  # just these domains
 *
 * Env: DATABASE_URL_OWNER (or DATABASE_URL) when no explicit domains are given.
 *      TENANT_ID to scope the DB lookup (defaults to the Elevay tenant).
 *
 * Read-only. Uses public DNS resolvers (1.1.1.1 / 8.8.8.8) so it works even
 * when the host's default resolver is a non-recursive stub.
 */

import { Resolver } from "node:dns/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { dnsAuthLookup } from "../src/lib/sending/identity/dns-auth-lookup";
import { verifyAuth } from "../src/lib/sending/identity/auth";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ELEVAY_TENANT = "fdf9b795-d0e3-4ca8-bb76-b298aa81e3b5";

function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const envPath = join(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return undefined;
  const line = readFileSync(envPath, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : undefined;
}
const maskUrl = (s: string) => s.replace(/:\/\/[^@\s]*@/g, "://***:***@");

async function loadTenantDomains(): Promise<string[]> {
  const url = readEnv("DATABASE_URL_OWNER") ?? readEnv("DATABASE_URL");
  if (!url) {
    console.error("[verify-domains] need DATABASE_URL_OWNER (or pass domains as args)");
    process.exit(2);
  }
  const tenantId = readEnv("TENANT_ID") ?? ELEVAY_TENANT;
  console.log(`[verify-domains] db=${maskUrl(url)} tenant=${tenantId}`);
  const sql = postgres(url, { ssl: "require", max: 1, idle_timeout: 5 });
  try {
    const rows = await sql`
      select distinct domain from connected_mailboxes
      where tenant_id = ${tenantId} and domain is not null
      order by domain`;
    return rows.map((r) => r.domain as string);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const argDomains = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const domains = argDomains.length > 0 ? argDomains : await loadTenantDomains();
  if (domains.length === 0) {
    console.log("[verify-domains] no domains found.");
    return;
  }

  // Public-DNS resolver so the grader sees real records regardless of the host stub.
  const resolver = new Resolver();
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  const resolveTxt = (host: string) => resolver.resolveTxt(host);

  console.log(`[verify-domains] grading ${domains.length} domain(s) against the spec-21 capacity gate\n`);
  let sendable = 0;
  for (const domain of domains) {
    const records = await dnsAuthLookup(domain, { resolveTxt });
    const status = verifyAuth(domain, records);
    if (status.sendable) sendable += 1;
    const flag = status.sendable ? "SENDABLE" : "BLOCKED ";
    const detail = status.sendable
      ? `dkim=${records.dkimBits}bit`
      : `fails: ${status.failures.join(", ")}`;
    console.log(`  ${flag} ${domain.padEnd(20)} spf=${status.spf} dkim=${status.dkim} dmarc=${status.dmarc}  ${detail}`);
  }
  console.log(`\n[verify-domains] ${sendable}/${domains.length} would earn owner-SMTP capacity today.`);
  if (sendable < domains.length) {
    console.log(`[verify-domains] to clear "dkim-weak": rotate DKIM to 2048-bit; to clear "dmarc": set p=quarantine.`);
  }
}

main().catch((err) => {
  console.error("[verify-domains] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
