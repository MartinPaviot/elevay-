import postgres from "postgres";
async function main() {
  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  const t = "47dca783-dac0-45a5-85cb-d217b2a3174d";
  const [icp] = await s`SELECT id, name FROM icps WHERE tenant_id=${t} AND name='Scale-up Tech / SaaS B2B'`;
  const crits = await s`SELECT id, field_key, is_required FROM icp_criteria WHERE icp_id=${icp.id}`;
  const fk = new Map(crits.map((c) => [c.id as string, c.field_key as string]));

  const rows = await s`
    SELECT c.name, c.properties->>'country' AS country, c.properties->>'state' AS state,
           c.industry, f.fit_score, f.matched_criteria
    FROM companies c
    JOIN company_icp_fit f ON f.company_id = c.id AND f.icp_id = ${icp.id}
    WHERE c.tenant_id=${t} AND c.properties->>'source'='tam'
    ORDER BY f.fit_score DESC`;

  console.log(`ICP-1 fit for ${rows.length} TAM-sourced companies:\n`);
  for (const r of rows) {
    const mc = r.matched_criteria as { matched: string[]; unmatched: string[]; excludedBy: string | null };
    const matched = (mc.matched ?? []).map((id) => fk.get(id) ?? id).join(",");
    const unmatched = (mc.unmatched ?? []).map((id) => fk.get(id) ?? id).join(",");
    const excl = mc.excludedBy ? fk.get(mc.excludedBy) : null;
    console.log(`${(Number(r.fit_score)).toFixed(2)}  ${String(r.name).slice(0, 28).padEnd(28)} [${r.state ?? "?"}/${r.country ?? "?"} · ${String(r.industry ?? "?").slice(0,22)}]`);
    console.log(`      matched: ${matched || "(none)"}`);
    console.log(`      unmatched: ${unmatched || "(none)"}${excl ? `  EXCLUDED-BY: ${excl}` : ""}`);
  }
  const strong = rows.filter((r) => Number(r.fit_score) >= 0.5).length;
  console.log(`\nstrong (>=0.5): ${strong}/${rows.length}`);
  await s.end();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
