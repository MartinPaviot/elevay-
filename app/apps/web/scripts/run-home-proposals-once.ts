/**
 * home-proposed-lane — run one tenant's proposal pass NOW, without waiting
 * for the 8am cron (inngest/home-proposals-cron.ts). Same code path
 * (draftProposalsForTenant); useful after seeding signals or for a live
 * verify.
 *
 * Usage:
 *   DATABASE_URL=... tsx scripts/run-home-proposals-once.ts <tenantId>
 */

import { draftProposalsForTenant } from "@/lib/home/sequence-proposals-draft";

async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error("usage: tsx scripts/run-home-proposals-once.ts <tenantId>");
    process.exit(1);
  }
  const result = await draftProposalsForTenant(tenantId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
