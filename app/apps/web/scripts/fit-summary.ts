import postgres from "postgres";
async function main() {
  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  const t = "47dca783-dac0-45a5-85cb-d217b2a3174d";
  const icps = await s`SELECT id, name, priority FROM icps WHERE tenant_id=${t} AND status='active' ORDER BY priority`;
  for (const icp of icps) {
    const [crit] = await s`SELECT id FROM icp_criteria WHERE icp_id=${icp.id} AND field_key='industry' LIMIT 1`;
    const industryId = crit?.id as string | undefined;
    const bands = await s`
      SELECT
        count(*) FILTER (WHERE fit_score >= 0.5)::int strong,
        count(*) FILTER (WHERE fit_score >= 0.7)::int great,
        count(*) FILTER (WHERE fit_score > 0 AND fit_score < 0.5)::int weak,
        count(*) FILTER (WHERE fit_score = 0)::int zero,
        count(*)::int total
      FROM company_icp_fit WHERE icp_id=${icp.id}`;
    const b = bands[0];
    // on-industry among strong: matched_criteria.matched contains industry criterion id
    let onIndustryStrong = 0;
    if (industryId) {
      const r = await s`
        SELECT count(*)::int n FROM company_icp_fit
        WHERE icp_id=${icp.id} AND fit_score >= 0.5
          AND matched_criteria->'matched' ? ${industryId}`;
      onIndustryStrong = r[0].n;
    }
    console.log(`\nICP p${icp.priority}: ${icp.name}`);
    console.log(`   total scored: ${b.total}`);
    console.log(`   fit >=0.7 (great): ${b.great}`);
    console.log(`   fit >=0.5 (strong/"fit"): ${b.strong}  — of which industry-matched: ${onIndustryStrong} (${b.strong ? Math.round(100*onIndustryStrong/b.strong) : 0}%)`);
    console.log(`   fit 0<x<0.5 (weak): ${b.weak}`);
    console.log(`   fit =0 (excluded/no-region): ${b.zero}`);
  }
  await s.end();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
