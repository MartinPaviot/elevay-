import { describe, it, expect } from "vitest";
import {
  LIFECYCLE_STAGES,
  LIFECYCLE_AUTO,
  normalizeLifecycleStage,
  deriveLifecycleStage,
  EFFECTIVE_LIFECYCLE_STAGE_SQL,
} from "@/lib/accounts/lifecycle-stage";

describe("normalizeLifecycleStage", () => {
  it("accepts every canonical stage", () => {
    for (const s of LIFECYCLE_STAGES) expect(normalizeLifecycleStage(s)).toBe(s);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(normalizeLifecycleStage("Customer")).toBe("customer");
    expect(normalizeLifecycleStage("  NURTURE ")).toBe("nurture");
    expect(normalizeLifecycleStage(" Auto")).toBe(LIFECYCLE_AUTO);
  });

  it("rejects anything outside the canonical list", () => {
    expect(normalizeLifecycleStage("churned")).toBe(null);
    expect(normalizeLifecycleStage("won")).toBe(null);
    expect(normalizeLifecycleStage("")).toBe(null);
  });
});

describe("deriveLifecycleStage (precedence: manual > won > open > lost > new)", () => {
  const none = { hasWonDeal: false, hasOpenDeal: false, hasLostDeal: false };

  it("defaults to new with no override and no deals", () => {
    expect(deriveLifecycleStage(none)).toBe("new");
  });

  it("any won deal makes the account a customer, even with open/lost deals", () => {
    expect(deriveLifecycleStage({ hasWonDeal: true, hasOpenDeal: true, hasLostDeal: true })).toBe("customer");
  });

  it("an open deal makes the account an opportunity", () => {
    expect(deriveLifecycleStage({ ...none, hasOpenDeal: true })).toBe("opportunity");
    expect(deriveLifecycleStage({ ...none, hasOpenDeal: true, hasLostDeal: true })).toBe("opportunity");
  });

  it("only lost deals park the account in nurture", () => {
    expect(deriveLifecycleStage({ ...none, hasLostDeal: true })).toBe("nurture");
  });

  it("a manual override pins the stage regardless of deals", () => {
    expect(deriveLifecycleStage({ manual: "disqualified", hasWonDeal: true, hasOpenDeal: true, hasLostDeal: false })).toBe("disqualified");
  });

  it("lowercases a stored override (mirrors lower() in the SQL)", () => {
    expect(deriveLifecycleStage({ manual: "Disqualified", ...none })).toBe("disqualified");
  });

  it("a blank override is ignored (mirrors NULLIF(btrim(...), ''))", () => {
    expect(deriveLifecycleStage({ manual: "  ", ...none, hasOpenDeal: true })).toBe("opportunity");
    expect(deriveLifecycleStage({ manual: null, ...none })).toBe("new");
  });
});

describe("EFFECTIVE_LIFECYCLE_STAGE_SQL", () => {
  // The drizzle subquery footgun: ${table.col} in sql`` renders unqualified
  // and binds to the inner table in correlated subqueries. The expression
  // must qualify every companies column literally.
  it("qualifies all companies columns against the correlated subqueries", () => {
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain('"companies"."id"');
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain('"companies"."tenant_id"');
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain('"companies"."properties"');
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain('"deals"."company_id"');
  });

  it("mirrors deriveLifecycleStage: manual slot, won, not-closed = open, lost, default", () => {
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain("->>'lifecycleStage'");
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain("lower(");
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain("= 'won'");
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain("= 'lost'");
    // Open = anything not closed, so a future in-flight stage derives
    // 'opportunity' without touching this module.
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain("IS DISTINCT FROM 'won'");
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain("IS DISTINCT FROM 'lost'");
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).toContain("ELSE 'new'");
  });

  it("only counts live deals", () => {
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL.match(/"deals"\."deleted_at" IS NULL/g)?.length).toBe(3);
  });

  it("carries no bound params so it is safe for sql.raw and raw queries", () => {
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).not.toContain("$");
    expect(EFFECTIVE_LIFECYCLE_STAGE_SQL).not.toContain("${");
  });
});
