import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  activities: {},
  contextGraphEdges: { tenantId: "", sourceNodeId: "", targetNodeId: "", tExpired: "", relationType: "", fact: "", tValid: "", confidence: "", tCreated: "" },
  contextGraphNodes: { id: "", entityType: "", entityId: "", tenantId: "" },
}));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), desc: vi.fn(), eq: vi.fn(), or: vi.fn(), inArray: vi.fn(), isNull: vi.fn() }));
vi.mock("@/lib/context/prospect-context", () => ({ buildProspectContext: vi.fn(), formatContextForPrompt: vi.fn() }));

import { loadGraphFactsForContact } from "@/lib/context/enriched-prospect-context";
import { db } from "@/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chain(result: unknown[]): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = { from: () => c, where: () => c, orderBy: () => c, limit: () => Promise.resolve(result) };
  return c;
}

function sequence(results: unknown[][]) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(((): unknown => chain(results[call++] ?? [])) as never);
}

const edge = (relation: string, confidence: number, date: string) => ({
  relationType: relation,
  fact: `${relation} fact`,
  tValid: new Date(date),
  confidence,
});

beforeEach(() => vi.clearAllMocks());

describe("loadGraphFactsForContact (P1-16)", () => {
  it("no nodes -> [] (no edge query)", async () => {
    sequence([[]]); // nodes empty
    expect(await loadGraphFactsForContact("c1", "t1")).toEqual([]);
  });

  it("returns valid facts sorted by confidence desc, capped at 8", async () => {
    const nodes = [{ id: "n1" }];
    const edges = [
      edge("DISCUSSED", 0.3, "2026-01-01"),
      edge("OBJECTED_TO", 0.9, "2026-02-01"),
      edge("REQUESTED", 0.7, "2026-03-01"),
      edge("a", 0.6, "2026-01-01"),
      edge("b", 0.55, "2026-01-01"),
      edge("c", 0.5, "2026-01-01"),
      edge("d", 0.45, "2026-01-01"),
      edge("e", 0.4, "2026-01-01"),
      edge("f", 0.35, "2026-01-01"),
    ];
    sequence([nodes, edges]);

    const facts = await loadGraphFactsForContact("c1", "t1");
    expect(facts).toHaveLength(8);
    expect(facts[0].confidence).toBe(0.9);
    expect(facts[0].relation).toBe("OBJECTED_TO");
    // sorted descending
    for (let i = 1; i < facts.length; i++) {
      expect(facts[i - 1].confidence).toBeGreaterThanOrEqual(facts[i].confidence);
    }
    // the lowest-confidence (0.3) was dropped by the cap; 0.35 survives
    expect(facts.some((f) => f.confidence === 0.3)).toBe(false);
    expect(facts.some((f) => f.confidence === 0.35)).toBe(true);
  });
});
