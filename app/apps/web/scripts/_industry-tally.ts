/** Read-only: distinct industry values + counts across ALL live companies
 * (every tenant), to ground the industry icon/color mapping on real data. */
import postgres from "postgres";
async function main() {
  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  const rows = await s`
    SELECT COALESCE(industry,'(null)') ind, count(*)::int n
    FROM companies
    WHERE deleted_at IS NULL
    GROUP BY 1 ORDER BY 2 DESC`;
  let tot = 0;
  for (const r of rows) { tot += r.n; console.log(`  ${String(r.ind).padEnd(48)} ${String(r.n).padStart(5)}`); }
  console.log(`\n  distinct=${rows.length} total=${tot}`);
  await s.end();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
