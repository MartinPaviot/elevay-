import postgres from "postgres";
async function main() {
  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  const icpTenants = await s`
    SELECT i.tenant_id, t.name AS tenant_name,
           count(*)::int AS icp_count,
           string_agg(i.name, ', ' ORDER BY i.priority) AS icps
    FROM icps i JOIN tenants t ON t.id = i.tenant_id
    WHERE i.status = 'active'
    GROUP BY i.tenant_id, t.name`;
  console.log("=== Active ICPs by tenant ===");
  for (const r of icpTenants) console.log(`  tenant ${r.tenant_id} (${r.tenant_name}): ${r.icp_count} → ${r.icps}`);

  const pilaeUsers = await s`SELECT email FROM users WHERE tenant_id = 'pilae'`;
  console.log(`\nUsers on tenant 'pilae': ${pilaeUsers.length === 0 ? "NONE (SQL-seeded, no human attached)" : pilaeUsers.map((u) => u.email).join(", ")}`);

  const martin = await s`SELECT id, email, tenant_id FROM users WHERE email = 'martin@elevay.dev'`;
  console.log(`Martin's user: ${martin.map((u) => `${u.email} → tenant ${u.tenant_id}`).join(", ") || "not found"}`);
  await s.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
