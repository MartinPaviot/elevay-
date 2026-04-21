/**
 * Post-migration sanity check. Confirms the `custom_signals`
 * table and its indexes actually landed in the DB — the runner
 * reports "done" even if some statements no-oped due to
 * `IF NOT EXISTS`, so we verify structure explicitly.
 *
 * Run with: `npx tsx scripts/verify-migration-0023.ts`
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, prepare: false });

async function main() {
  try {
    const cols = await sql<
      Array<{ column_name: string; data_type: string; is_nullable: string }>
    >`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'custom_signals'
      ORDER BY ordinal_position
    `;
    if (cols.length === 0) {
      console.error("FAIL: table custom_signals not found");
      process.exit(2);
    }
    console.log(`custom_signals columns (${cols.length}):`);
    for (const c of cols) {
      console.log(`  ${c.column_name.padEnd(22)} ${c.data_type.padEnd(32)} ${c.is_nullable === "YES" ? "NULL" : "NOT NULL"}`);
    }

    const indexes = await sql<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'custom_signals'
      ORDER BY indexname
    `;
    console.log(`\nindexes (${indexes.length}):`);
    for (const i of indexes) {
      console.log(`  ${i.indexname}`);
    }

    const fks = await sql<
      Array<{ constraint_name: string; column_name: string; foreign_table: string; foreign_column: string }>
    >`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'custom_signals'
        AND tc.constraint_type = 'FOREIGN KEY'
    `;
    console.log(`\nforeign keys (${fks.length}):`);
    for (const f of fks) {
      console.log(`  ${f.column_name} → ${f.foreign_table}(${f.foreign_column})`);
    }

    // Sanity: expected 11 columns, 3 indexes (PK + 2 secondary), 2 FKs.
    const expectedCols = 11;
    const expectedIdx = 3;
    const expectedFks = 2;
    const ok =
      cols.length === expectedCols &&
      indexes.length === expectedIdx &&
      fks.length === expectedFks;

    console.log(
      `\nresult: ${ok ? "PASS" : "FAIL"} (got ${cols.length}/${expectedCols} cols, ${indexes.length}/${expectedIdx} idx, ${fks.length}/${expectedFks} fk)`,
    );
    await sql.end({ timeout: 1 });
    process.exit(ok ? 0 : 3);
  } catch (err) {
    console.error("verify failed:", (err as Error).message);
    await sql.end({ timeout: 1 });
    process.exit(2);
  }
}

main();
