/**
 * Keep ONLY the named ICPs on a tenant; delete the rest (e.g. the
 * empty retro-compat "Default"). Cascades criteria + fit rows.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/clean-tenant-icps.ts <tenant> "Name A" "Name B" ...
 */
import postgres from "postgres";

async function main() {
  const tenant = process.argv[2];
  const keep = process.argv.slice(3);
  if (!tenant || keep.length === 0) { console.error("usage: <tenant> <keep names...>"); process.exit(1); }

  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  const before = await s`SELECT name, status FROM icps WHERE tenant_id = ${tenant} ORDER BY priority`;
  console.log("before:", before.map((r) => `${r.name}(${r.status})`).join(", "));

  const del = await s`DELETE FROM icps WHERE tenant_id = ${tenant} AND name <> ALL(${keep}) RETURNING name`;
  console.log("deleted:", del.map((r) => r.name).join(", ") || "none");

  const after = await s`SELECT name, status, priority FROM icps WHERE tenant_id = ${tenant} ORDER BY priority`;
  console.log("after:", after.map((r) => `${r.name}(${r.status}, p${r.priority})`).join(", "));
  await s.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
