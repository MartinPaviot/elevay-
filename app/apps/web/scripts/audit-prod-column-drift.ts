/**
 * READ-ONLY audit: column-level migration drift.
 * Expected columns per table = (CREATE TABLE column list) ∪ (ALTER TABLE ADD COLUMN),
 * derived from drizzle/*.sql. Safe because the migrations contain 0 DROP COLUMN
 * and 0 RENAME COLUMN (verified), so the union is the true final column set.
 * Diffs that against information_schema.columns in the connected DB.
 * Reports columns that the code expects but prod lacks (these 500 at query time).
 * No writes.
 */
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = (process.env.DATABASE_URL || "")
  .replace(/[\r\n\s]+/g, "")
  .replace(/(\/[A-Za-z0-9_]+)(?:[\\/]n|\\n)?$/, "$1")
  .trim();
if (!url) throw new Error("DATABASE_URL missing");

const drizzleDir = new URL("../drizzle/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const files = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql")).sort();

const expected = new Map<string, Set<string>>();
const add = (t: string, c: string) => {
  if (!expected.has(t)) expected.set(t, new Set());
  expected.get(t)!.add(c);
};

for (const f of files) {
  const text = readFileSync(join(drizzleDir, f), "utf8");
  const stmts = text.split(/-->\s*statement-breakpoint|;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    const create = stmt.match(/CREATE TABLE (?:IF NOT EXISTS )?"([a-z_]+)"\s*\(([\s\S]*)\)/i);
    if (create) {
      const table = create[1];
      const body = create[2];
      for (const line of body.split("\n")) {
        const m = line.match(/^\s*"([a-z_]+)"\s+\S/); // column def line (not CONSTRAINT, which starts with the word)
        if (m && !/^\s*CONSTRAINT/i.test(line)) add(table, m[1]);
      }
      continue;
    }
    const addCol = stmt.match(/ALTER TABLE "([a-z_]+)" ADD COLUMN (?:IF NOT EXISTS )?"([a-z_]+)"/i);
    if (addCol) add(addCol[1], addCol[2]);
  }
}

async function main() {
  const sql = postgres(url, { max: 1 });
  console.log(`host: ${new URL(url).host}  tables with declared columns: ${expected.size}`);

  let driftCount = 0;
  for (const [table, cols] of [...expected].sort()) {
    const reg = await sql`SELECT to_regclass(${"public." + table})::text AS reg`;
    if (!reg[0].reg) continue; // table-level drift handled separately
    const actual = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}`;
    const have = new Set(actual.map((r) => r.column_name));
    const missing = [...cols].filter((c) => !have.has(c));
    if (missing.length) {
      driftCount++;
      console.log(`  ${table}: MISSING ${missing.length} -> ${missing.join(", ")}`);
    }
  }
  console.log(driftCount ? `\n${driftCount} table(s) with column drift` : "\nno column drift — all expected columns present");
  await sql.end();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
