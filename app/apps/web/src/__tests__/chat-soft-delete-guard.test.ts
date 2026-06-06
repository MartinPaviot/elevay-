/**
 * Regression guard for the pre-launch audit (2026-06-06) headline bug:
 * the chat tools queried contacts/companies/deals/activities/notes/tasks
 * WITHOUT filtering `deleted_at IS NULL`, so the assistant reported
 * soft-deleted rows as live data — e.g. "$618,999 across 12 open deals"
 * and "519 contacts" while the UI (which filters soft-deletes) showed
 * 0 / 0. See _audit/2026-06-06-prelaunch/PM-REPORT.md (P0 #1).
 *
 * Invariant: in every chat data-source file, each read of a
 * soft-deletable table must be accompanied by a `<table>.deletedAt`
 * filter (isNull / notDeleted). This is a structural guard (no DB
 * needed) — it would have failed before the fix and fails again if a
 * new query forgets the filter.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..");

// Tables with a `deleted_at` soft-delete column that the chat surfaces.
const SOFT_TABLES = ["deals", "companies", "contacts", "activities", "notes", "tasks"] as const;

// Chat data-source files that read CRM entities and feed the assistant.
const GUARDED_FILES = [
  "lib/chat/tools/query.ts",
  "lib/chat/tools/intelligence.ts",
  "lib/chat/tools/forecast.ts",
  "lib/deals/deal-briefing.ts",
  "lib/sandbox/crm-bridge.ts",
];

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("chat tools exclude soft-deleted rows (audit 2026-06-06 P0 #1)", () => {
  for (const rel of GUARDED_FILES) {
    const src = readFileSync(join(SRC, rel), "utf-8");
    for (const table of SOFT_TABLES) {
      const fromCount = count(src, `.from(${table})`);
      if (fromCount === 0) continue;
      it(`${rel}: every .from(${table}) filters ${table}.deletedAt`, () => {
        const filterCount = count(src, `${table}.deletedAt`);
        expect(
          filterCount,
          `${rel} has ${fromCount} \`.from(${table})\` read(s) but only ${filterCount} \`${table}.deletedAt\` filter(s). Every chat read of a soft-deletable table must filter deleted_at so the assistant never reports deleted records as live (see _audit/2026-06-06-prelaunch).`
        ).toBeGreaterThanOrEqual(fromCount);
      });
    }
  }

  it("query.ts runBasicReport (generic cfg.table) filters deletedAt", () => {
    const src = readFileSync(join(SRC, "lib/chat/tools/query.ts"), "utf-8");
    expect(src).toContain("isNull(cfg.table.deletedAt)");
  });
});
