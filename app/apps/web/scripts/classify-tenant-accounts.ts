import postgres from "postgres";
async function main() {
  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  const t = "47dca783-dac0-45a5-85cb-d217b2a3174d";
  const bySource = await s`
    SELECT COALESCE(properties->>'source','(none)') AS source, count(*)::int n
    FROM companies WHERE tenant_id = ${t} GROUP BY 1 ORDER BY 2 DESC`;
  console.log("companies by properties.source:");
  for (const r of bySource) console.log(`   ${String(r.source).padEnd(18)} ${r.n}`);

  const fit = await s`
    SELECT i.name, count(f.*)::int rows,
      count(*) FILTER (WHERE f.fit_score >= 0.5)::int strong
    FROM icps i LEFT JOIN company_icp_fit f ON f.icp_id = i.id
    WHERE i.tenant_id = ${t} AND i.status='active' GROUP BY i.name ORDER BY i.name`;
  console.log("\nfit matrix per ICP:");
  for (const r of fit) console.log(`   ${String(r.name).padEnd(30)} rows=${r.rows} strong=${r.strong}`);

  await s.end();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
