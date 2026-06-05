/**
 * Copy active ICPs (+ criteria) from one tenant to another, idempotent
 * (skips by name on the target). Used to surface the Pilae ICPs on
 * Martin's own tenant so they're visible in the UI when he logs in.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/copy-icps-to-tenant.ts <sourceTenant> <targetTenant>
 */
import postgres from "postgres";

async function main() {
  const source = process.argv[2] ?? "pilae";
  const target = process.argv[3];
  if (!target) { console.error("target tenant required"); process.exit(1); }

  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  const icps = await s`SELECT id, name, description, status, priority, metadata FROM icps WHERE tenant_id = ${source} AND status = 'active'`;
  console.log(`Source ${source}: ${icps.length} active ICPs`);

  let copied = 0;
  for (const icp of icps) {
    const [exists] = await s`SELECT id FROM icps WHERE tenant_id = ${target} AND name = ${icp.name} LIMIT 1`;
    if (exists) { console.log(`  [--] "${icp.name}" already on target`); continue; }
    const [newIcp] = await s`
      INSERT INTO icps (id, tenant_id, name, description, status, priority, metadata)
      VALUES (gen_random_uuid()::text, ${target}, ${icp.name}, ${icp.description}, 'active', ${icp.priority}, ${s.json((icp.metadata as object) ?? {})})
      RETURNING id`;
    const crits = await s`SELECT field_key, operator, value, weight, is_required FROM icp_criteria WHERE icp_id = ${icp.id}`;
    for (const c of crits) {
      await s`
        INSERT INTO icp_criteria (id, icp_id, field_key, operator, value, weight, is_required)
        VALUES (gen_random_uuid()::text, ${newIcp.id}, ${c.field_key}, ${c.operator}, ${s.json((c.value as object) ?? null)}, ${c.weight}, ${c.is_required})`;
    }
    console.log(`  [OK] "${icp.name}" + ${crits.length} criteria → ${target}`);
    copied++;
  }
  console.log(`\nCopied ${copied} ICPs to ${target}.`);
  await s.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
