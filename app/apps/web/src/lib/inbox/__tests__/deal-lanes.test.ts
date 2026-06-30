import { describe, it, expect } from "vitest";
import { rankDealLanes, dealLaneId, isDealLaneId, type DealRow } from "@/lib/inbox/deal-lanes";

const row = (over: Partial<DealRow>): DealRow => ({ id: "d1", name: "Acme", stage: "lead", contactId: "c1", ...over });

describe("dealLaneId / isDealLaneId", () => {
  it("round-trips the deal:<id> form", () => {
    expect(dealLaneId("abc")).toBe("deal:abc");
    expect(isDealLaneId("deal:abc")).toBe(true);
    expect(isDealLaneId("attention")).toBe(false);
    expect(isDealLaneId(null)).toBe(false);
  });
});

describe("rankDealLanes", () => {
  it("shapes rows into lanes with a deal:<id> id and stage rank", () => {
    const [lane] = rankDealLanes([row({ id: "d9", name: "Northwind", stage: "proposal", contactId: "c9" })]);
    expect(lane).toMatchObject({ id: "deal:d9", dealId: "d9", name: "Northwind", stage: "proposal", contactId: "c9" });
    expect(lane.stageRank).toBe(5);
  });

  it("orders hottest stage first (negotiation > proposal > demo > lead)", () => {
    const lanes = rankDealLanes([
      row({ id: "a", stage: "lead" }),
      row({ id: "b", stage: "negotiation" }),
      row({ id: "c", stage: "demo" }),
      row({ id: "d", stage: "proposal" }),
    ]);
    expect(lanes.map((l) => l.dealId)).toEqual(["b", "d", "c", "a"]);
  });

  it("preserves input order (recency) within the same stage", () => {
    const lanes = rankDealLanes([
      row({ id: "recent", stage: "demo" }),
      row({ id: "older", stage: "demo" }),
    ]);
    expect(lanes.map((l) => l.dealId)).toEqual(["recent", "older"]);
  });

  it("caps at the limit", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row({ id: `d${i}`, stage: "lead" }));
    expect(rankDealLanes(rows, 12)).toHaveLength(12);
  });

  it("falls back to a non-empty name and stage", () => {
    const [lane] = rankDealLanes([row({ id: "x", name: "  ", stage: null })]);
    expect(lane.name).toBe("Deal");
    expect(lane.stage).toBe("lead");
    expect(lane.stageRank).toBe(1);
  });
});
