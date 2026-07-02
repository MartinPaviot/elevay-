import { describe, expect, it } from "vitest";
import {
  selectRecipeChips,
  EMPTY_TENANT_SIGNALS,
  RECIPE_IDS,
  type TenantSignals,
} from "../recipes";

const sig = (over: Partial<TenantSignals> = {}): TenantSignals => ({
  ...EMPTY_TENANT_SIGNALS,
  ...over,
});

/** Epoch-day 0 → rotation offset 0 → pure priority order. */
const DAY0 = new Date(0);
const day = (n: number) => new Date(n * 86_400_000);

describe("recipe gates", () => {
  it("empty tenant is eligible for nothing", () => {
    expect(selectRecipeChips(sig(), 3, DAY0)).toEqual([]);
  });

  it("define-icp requires 0 ICPs AND ≥50 companies", () => {
    expect(pick(sig({ companiesTotal: 100, icpCount: 0 }))).toContain("recipe:define-icp");
    expect(pick(sig({ companiesTotal: 100, icpCount: 1 }))).not.toContain("recipe:define-icp");
    expect(pick(sig({ companiesTotal: 49, icpCount: 0 }))).not.toContain("recipe:define-icp");
  });

  it("call-list requires ≥10 contacts with a phone", () => {
    expect(pick(sig({ contactsWithPhone: 10 }))).toContain("recipe:call-list");
    expect(pick(sig({ contactsWithPhone: 9 }))).not.toContain("recipe:call-list");
  });

  it("cold-sequence requires a seeded KB and ≥20 contacts (copy-quality guard)", () => {
    expect(pick(sig({ knowledgeEntries: 1, contactsTotal: 20 }))).toContain("recipe:cold-sequence");
    expect(pick(sig({ knowledgeEntries: 0, contactsTotal: 500 }))).not.toContain("recipe:cold-sequence");
    expect(pick(sig({ knowledgeEntries: 5, contactsTotal: 19 }))).not.toContain("recipe:cold-sequence");
  });

  it("inbound-recap requires inbound email this week", () => {
    expect(pick(sig({ inbound7d: 1 }))).toContain("recipe:inbound-recap");
    expect(pick(sig({ inbound7d: 0 }))).not.toContain("recipe:inbound-recap");
  });

  it("enroll-list requires a ≥10-member list AND an existing sequence", () => {
    const list = { id: "l1", name: "Q3 targets", members: 12 };
    expect(pick(sig({ biggestList: list, sequencesTotal: 1 }))).toContain("recipe:enroll-list");
    expect(pick(sig({ biggestList: list, sequencesTotal: 0 }))).not.toContain("recipe:enroll-list");
    expect(
      pick(sig({ biggestList: { ...list, members: 9 }, sequencesTotal: 1 })),
    ).not.toContain("recipe:enroll-list");
  });

  it("signals-scan requires ≥50 companies; sequence-performance requires enrollments", () => {
    expect(pick(sig({ companiesTotal: 50, icpCount: 1 }))).toContain("recipe:signals-scan");
    expect(pick(sig({ sequencesWithEnrollments: 1 }))).toContain("recipe:sequence-performance");
  });
});

describe("slot filling", () => {
  it("labels carry the tenant's own numbers", () => {
    const chips = selectRecipeChips(
      sig({ companiesTotal: 885, icpCount: 0, contactsWithPhone: 43, inbound7d: 12 }),
      3,
      DAY0,
    );
    const labels = chips.map((c) => c.label);
    expect(labels).toContain("Define my ICP from my 885 accounts");
    expect(labels).toContain("Build today's call list (43 callable)");
    expect(labels).toContain("Recap the 12 emails received this week");
  });

  it("singular count reads singular", () => {
    const chips = selectRecipeChips(sig({ inbound7d: 1 }), 1, DAY0);
    expect(chips[0].label).toBe("Recap the 1 email received this week");
  });

  it("cold-sequence targets the biggest list by name when one exists", () => {
    const chips = selectRecipeChips(
      sig({
        knowledgeEntries: 3,
        contactsTotal: 100,
        biggestList: { id: "l1", name: "Suisse romande CTOs", members: 40 },
      }),
      1,
      DAY0,
    );
    expect(chips[0].label).toBe('Draft a cold sequence for "Suisse romande CTOs"');
    expect(chips[0].send).toContain('"Suisse romande CTOs" account list');
    expect(chips[0].send).toContain("do not enroll or send");
  });
});

describe("rotation and caps", () => {
  const threeEligible = sig({ companiesTotal: 100, icpCount: 0, contactsWithPhone: 20 });
  // eligible (priority order): define-icp, call-list, signals-scan

  it("day 0 returns pure priority order", () => {
    expect(selectRecipeChips(threeEligible, 3, DAY0).map((c) => c.id)).toEqual([
      "recipe:define-icp",
      "recipe:call-list",
      "recipe:signals-scan",
    ]);
  });

  it("the day offset rotates the circular pick, stable within a day", () => {
    const d1 = selectRecipeChips(threeEligible, 1, day(1)).map((c) => c.id);
    expect(d1).toEqual(["recipe:call-list"]);
    expect(selectRecipeChips(threeEligible, 1, day(1)).map((c) => c.id)).toEqual(d1);
    expect(selectRecipeChips(threeEligible, 1, day(2)).map((c) => c.id)).toEqual([
      "recipe:signals-scan",
    ]);
    expect(selectRecipeChips(threeEligible, 1, day(3)).map((c) => c.id)).toEqual([
      "recipe:define-icp",
    ]);
  });

  it("slots cap the pick; zero slots return nothing", () => {
    expect(selectRecipeChips(threeEligible, 2, DAY0)).toHaveLength(2);
    expect(selectRecipeChips(threeEligible, 0, DAY0)).toEqual([]);
  });

  it("a deal_risk work chip suppresses the redundant deals-at-risk recipe", () => {
    const s = sig({ openDeals: 3 });
    expect(pick(s)).toContain("recipe:deals-at-risk");
    expect(
      selectRecipeChips(s, 3, DAY0, new Set(["deal_risk"])).map((c) => c.id),
    ).not.toContain("recipe:deals-at-risk");
  });

  it("every chip is kind recipe with a send and no href", () => {
    const chips = selectRecipeChips(threeEligible, 3, DAY0);
    for (const c of chips) {
      expect(c.kind).toBe("recipe");
      expect(c.send).toBeTruthy();
      expect(c.href).toBeUndefined();
      expect(RECIPE_IDS).toContain(c.id);
    }
  });

  it("single-tool recipes carry their pre-routing tool; multi-step ones do not", () => {
    const s = sig({ companiesTotal: 100, icpCount: 0, contactsWithPhone: 20, knowledgeEntries: 3, contactsTotal: 100 });
    const chips = selectRecipeChips(s, RECIPE_IDS.length, DAY0);
    const byId = Object.fromEntries(chips.map((c) => [c.id, c]));
    expect(byId["recipe:define-icp"].tool).toBe("defineICP");
    expect(byId["recipe:call-list"].tool).toBe("getCallList");
    expect(byId["recipe:signals-scan"].tool).toBe("scanSignals");
    expect(byId["recipe:cold-sequence"].tool).toBeUndefined();
  });
});

function pick(s: TenantSignals): string[] {
  return selectRecipeChips(s, RECIPE_IDS.length, DAY0).map((c) => c.id);
}
