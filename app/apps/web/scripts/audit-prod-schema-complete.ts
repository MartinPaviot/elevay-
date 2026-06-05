/**
 * READ-ONLY complete schema-drift audit (supersedes the quoted-only audits).
 * Handles BOTH quoted ("name") and unquoted (name) identifiers in drizzle/*.sql
 * — the earlier audits only matched quoted names and missed 31 tables.
 *
 * Reports, against the connected DB:
 *   - tables declared in migrations but MISSING in the DB
 *   - for present tables, columns declared but MISSING (col-level drift)
 * Migrations contain 0 DROP/RENAME COLUMN, so expected = union of CREATE-TABLE
 * columns + ADD COLUMN. No writes.
 */
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = (process.env.DATABASE_URL || "")
  .replace(/[\r\n\s]+/g, "")
  .replace(/(\/[A-Za-z0-9_]+)(?:[\\/]n|\\n)?$/, "$1")
  .trim();
if (!url) throw new Error("DATABASE_URL missing");

const RESERVED = new Set([
  "constraint", "primary", "foreign", "unique", "check", "references",
  "key", "create", "table", "default", "not", "null", "exists",
]);

const drizzleDir = new URL("../drizzle/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const files = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql")).sort();

const expected = new Map<string, Set<string>>();
const ensure = (t: string) => expected.has(t) ? expected.get(t)! : expected.set(t, new Set()).get(t)!;

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");

for (const f of files) {
  const text = stripComments(readFileSync(join(drizzleDir, f), "utf8"));
  const stmts = text.split(/-->\s*statement-breakpoint|;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    const create = stmt.match(/CREATE TABLE (?:IF NOT EXISTS )?"?([a-z_]+)"?\s*\(([\s\S]*)\)/i);
    if (create) {
      const cols = ensure(create[1]);
      for (const line of create[2].split("\n")) {
        const m = line.match(/^\s*"?([a-z_]+)"?\s+\S/);
        if (m && !RESERVED.has(m[1].toLowerCase())) cols.add(m[1]);
      }
      continue;
    }
    // whitespace-tolerant so multi-line "ALTER TABLE x\n ADD COLUMN y" is caught
    const addCol = stmt.match(/ALTER TABLE\s+"?([a-z_]+)"?\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"?([a-z_]+)"?/i);
    if (addCol) ensure(addCol[1]).add(addCol[2]);
  }
}

async function main() {
  const sql = postgres(url, { max: 1 });
  console.log(`host: ${new URL(url).host}  tables declared: ${expected.size}`);

  const missingTables: string[] = [];
  const colDrift: string[] = [];
  for (const [table, cols] of [...expected].sort()) {
    const reg = await sql`SELECT to_regclass(${"public." + table})::text AS reg`;
    if (!reg[0].reg) { missingTables.push(table); continue; }
    const actual = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}`;
    const have = new Set(actual.map((r) => r.column_name));
    const missing = [...cols].filter((c) => !have.has(c));
    if (missing.length) colDrift.push(`${table}: ${missing.join(", ")}`);
  }

  console.log(`\nMISSING TABLES (${missingTables.length}):`);
  if (missingTables.length) console.log("  " + missingTables.join(", "));
  console.log(`\nCOLUMN DRIFT (${colDrift.length} tables):`);
  for (const d of colDrift) console.log("  " + d);
  await sql.end();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
