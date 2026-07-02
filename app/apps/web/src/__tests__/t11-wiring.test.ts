import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T11 (outreach-autopilot) — drift guards for the outcomes-first Reports
 * screen. Static assertions, anchored on STRUCTURE with generous windows
 * (never a tight char count — the guard-window lesson):
 *  - the aggregate route groups gate rows by reasons.path (the ONLY thing
 *    that separates the two G2 producers under g2.det.v1),
 *  - the reports screen mounts the outcomes-first strip + gates + decisions,
 *  - open rate stays OFF the results screen (it is a deliverability metric).
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** Remove C-style block comments (including JSX comment wrappers) then line
 *  comments, so a negative assertion never trips on explanatory prose. */
const strip = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const ROUTE = "app/api/reports/outreach-learning/route.ts";
const PAGE = "app/(dashboard)/reports/page.tsx";
const STRIP = "app/(dashboard)/reports/_outreach-learning.tsx";

describe("T11 wiring guards (aggregate route)", () => {
  it("groups gate rows by (gate, rubricVersion, reasons.path) — not gate alone", () => {
    const src = strip(read(ROUTE));
    // The jsonb path discriminator is extracted and RETURNED.
    expect(src).toContain("->>'path'");
    expect(src).toMatch(/path:\s*pathExpr/);
    // The GROUP BY carries all three terms together (generous lazy window).
    expect(src).toMatch(
      /\.groupBy\([\s\S]{0,160}?gateDecisions\.gate[\s\S]{0,160}?gateDecisions\.rubricVersion[\s\S]{0,160}?pathExpr/,
    );
  });

  it("reads the three sources through the tenant-scoped tables", () => {
    const src = strip(read(ROUTE));
    expect(src).toContain("actionOutcomes");
    expect(src).toContain("outreachDecisions");
    expect(src).toContain("gateDecisions");
    // Decisions reuse the canonical aggregator, not a parallel bucket math.
    expect(src).toMatch(/from\s+["']@\/lib\/decision-insights\/aggregate["']/);
    expect(src).toContain("computeInsights");
    // Every aggregate is tenant-filtered.
    expect(src).toMatch(/eq\(\s*actionOutcomes\.tenantId/);
    expect(src).toMatch(/eq\(\s*outreachDecisions\.tenantId/);
    expect(src).toMatch(/eq\(\s*gateDecisions\.tenantId/);
  });
});

describe("T11 wiring guards (reports screen)", () => {
  it("the reports page mounts OutreachLearning above the always-on cards", () => {
    const src = read(PAGE);
    expect(src).toMatch(/from\s+["']\.\/_outreach-learning["']/);
    expect(src).toContain("<OutreachLearning");
    // The mount sits before the RevenueForecast/CohortInsights grid.
    const idxMount = src.indexOf("<OutreachLearning");
    const idxForecast = src.indexOf("<RevenueForecast");
    expect(idxMount).toBeGreaterThan(-1);
    expect(idxForecast).toBeGreaterThan(idxMount);
  });

  it("the strip renders outcomes-first (held/booked/replies lead, sends grayed) + gates + decisions", () => {
    const src = read(STRIP);
    // Outcomes strip.
    expect(src).toContain("Meetings held");
    expect(src).toContain("Meetings booked");
    expect(src).toContain("Positive replies");
    // Sends is de-emphasized: grayed via the tertiary token + a "volume" tier.
    expect(src).toContain("Sends");
    expect(src).toContain('emphasis="volume"');
    expect(src).toContain("var(--color-text-tertiary)");
    // Gates block-rate section with per-gate guided reading + inline bar.
    expect(src).toContain("Quality gates");
    expect(src).toContain("GATE_META");
    expect(src).toContain("blockRate");
    expect(src).toContain("data.gates.map");
    // Persona x signal decisions table.
    expect(src).toContain("persona x signal");
    expect(src).toContain("data.decisions.map");
    // It fetches the one aggregate route.
    expect(src).toContain("/api/reports/outreach-learning");
  });

  it("open rate is ABSENT from the results screen (it lives on deliverability)", () => {
    // Strip comments first: the prose explains WHY it is absent; the code
    // must not render an open-rate metric.
    expect(strip(read(PAGE))).not.toMatch(/open[\s-]?rate/i);
    expect(strip(read(STRIP))).not.toMatch(/open[\s-]?rate/i);
  });
});
