import postgres from "postgres";
async function main() {
  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  const t = "47dca783-dac0-45a5-85cb-d217b2a3174d";
  const icps = await s`SELECT id, name FROM icps WHERE tenant_id = ${t} AND status='active' ORDER BY priority`;
  for (const icp of icps) {
    const c = await s`SELECT count(*)::int n FROM icp_criteria WHERE icp_id = ${icp.id}`;
    console.log(`${icp.name} [${icp.id}]: ${c[0].n} criteria`);
    const sample = await s`SELECT field_key, operator FROM icp_criteria WHERE icp_id = ${icp.id} LIMIT 3`;
    console.log("   sample:", sample.map((r) => `${r.field_key}/${r.operator}`).join(", ") || "(none)");
  }
  await s.end();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
