/**
 * Backfill `metadata.to` on inbound `email_received` activities that were
 * orphaned when the cold-sync sentiment step overwrote their metadata and
 * dropped `to` (see inngest/sync-functions.ts). The per-user inbox attributes
 * inbound mail by `metadata.to` == the user's mailbox address, so these rows
 * were invisible in everyone's personal inbox.
 *
 * Safe + idempotent: only touches rows where `metadata.to` is absent, only in
 * tenants that have EXACTLY ONE connected mailbox (so the recipient is
 * unambiguous), and only sets `to` — it never fabricates from/subject.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-inbound-metadata-to.mjs              # dry run, all single-mailbox tenants
 *   node --env-file=.env.local scripts/backfill-inbound-metadata-to.mjs --apply      # execute
 *   node --env-file=.env.local scripts/backfill-inbound-metadata-to.mjs <tenantId> --apply
 */
import postgres from "postgres";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const tenantArg = args.find((a) => !a.startsWith("--")) || null;
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

// Tenants with exactly ONE connected mailbox → unambiguous inbound recipient.
const allTenants = await sql`
  SELECT tenant_id, max(email_address) AS address
  FROM connected_mailboxes
  GROUP BY tenant_id HAVING count(*) = 1`;
const tenants = tenantArg ? allTenants.filter((t) => t.tenant_id === tenantArg) : allTenants;

console.log(`single-mailbox tenants in scope: ${tenants.length}${apply ? "" : "  (DRY RUN)"}`);
let candidates = 0;
let updated = 0;
for (const t of tenants) {
  const [c] = await sql`
    SELECT count(*)::int AS n FROM activities
    WHERE tenant_id = ${t.tenant_id} AND activity_type = 'email_received'
      AND direction = 'inbound' AND deleted_at IS NULL AND (metadata ->> 'to') IS NULL`;
  candidates += c.n;
  console.log(`  ${t.tenant_id} -> ${t.address}: ${c.n} orphaned inbound`);
  if (apply && c.n > 0) {
    const res = await sql`
      UPDATE activities
      SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('to', ${t.address}::text)
      WHERE tenant_id = ${t.tenant_id} AND activity_type = 'email_received'
        AND direction = 'inbound' AND deleted_at IS NULL AND (metadata ->> 'to') IS NULL`;
    updated += res.count;
    console.log(`     updated ${res.count}`);
  }
}
console.log(`\ncandidates: ${candidates}${apply ? `, updated: ${updated}` : " (pass --apply to write)"}`);
await sql.end();
console.log("DONE");
