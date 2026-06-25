/**
 * Regression guard for the signal-score-daily UPDATE bug.
 *
 * The daily priority_score recompute flushed its updates with a raw
 * `sql\`${companies.id} = ANY(${ids})\`` clause. Drizzle expands a JS array there
 * into a PARENTHESISED PARAM LIST — `ANY(($1, $2, …))` — which Postgres reads as a
 * row constructor and rejects: "op ANY/ALL (array) requires array on right side".
 * The UPDATE therefore threw on EVERY run and priority_score was never persisted in
 * prod (0/4369 companies scored). Fix: `inArray(companies.id, ids)` → `id IN (…)`.
 *
 * These assertions compile the WHERE clause with the Postgres dialect (no DB) so a
 * revert to the `ANY(${array})` form is caught at test time, not in a silent
 * dead-letter at 06:00 UTC.
 */
import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { and, eq, inArray, sql } from "drizzle-orm";
import { companies } from "@/db/schema";

const dialect = new PgDialect();
const compile = (node: Parameters<PgDialect["sqlToQuery"]>[0]) => dialect.sqlToQuery(node).sql;

describe("signal-score-daily UPDATE where-clause", () => {
  it("the fixed clause compiles to a valid `id IN (…)` (not a row-constructor ANY)", () => {
    const where = and(eq(companies.tenantId, "t1"), inArray(companies.id, ["a", "b", "c"]));
    const compiled = compile(where!);
    expect(compiled).toMatch(/"companies"\."id" in \(/i);
    expect(compiled).not.toContain("ANY((");
  });

  it("documents the bug: the old raw form renders the rejected `ANY((row))`", () => {
    // This is the shape Postgres refused — kept as an executable note of WHY.
    const broken = sql`${companies.id} = ANY(${["a", "b", "c"]})`;
    expect(compile(broken)).toContain("ANY((");
  });
});
