import { describe, expect, it } from "vitest";
import { warmPathScoreContribution } from "@/lib/connection-graph/warm-path-score";
import { warmPathToAngle } from "@/lib/connection-graph/warm-angle";
import { resolveIntroPaths } from "@/lib/connection-graph/intro-paths";
import { buildAccountWarmPaths } from "@/lib/connection-graph/build-warm-paths";
import type {
  ConnectionEdge,
  WarmPath,
} from "@/lib/connection-graph/types";
import type { SharedConnections } from "@/lib/connection-graph/provider/types";

function edge(over: Partial<ConnectionEdge> = {}): ConnectionEdge {
  return {
    ownerUserId: "u1",
    tenantId: "t1",
    personExternalId: over.personExternalId ?? "p1",
    personName: over.personName ?? "Alice",
    personHeadline: null,
    rawCompanyName: null,
    rawCompanyDomain: null,
    resolvedCompanyId: over.resolvedCompanyId ?? null,
    networkDistance: over.networkDistance ?? "first",
    sharedConnectionsCount: over.sharedConnectionsCount ?? 0,
    source: "mock",
  };
}

const insider: WarmPath = {
  kind: "insider",
  strength: 0.8,
  connectors: [
    { personExternalId: "p1", personName: "Alice Martin", networkDistance: "first" },
  ],
};
const intro: WarmPath = {
  kind: "intro_path",
  strength: 0.3,
  connectors: [
    { personExternalId: "p2", personName: "Bob Durand", networkDistance: "first" },
  ],
};
const none: WarmPath = { kind: "none", strength: 0, connectors: [] };

describe("warmPathScoreContribution", () => {
  it("returns a neutral factor for no path", () => {
    expect(warmPathScoreContribution(none)).toEqual({ factor: 1, reason: null });
    expect(warmPathScoreContribution(null).factor).toBe(1);
  });

  it("boosts (never penalises) and caps the boost", () => {
    const ins = warmPathScoreContribution(insider);
    expect(ins.factor).toBeGreaterThan(1);
    expect(ins.factor).toBeLessThanOrEqual(1.5);
    expect(ins.reason).toMatch(/working here/);
    // Even a maxed strength can't exceed the cap.
    const huge = warmPathScoreContribution({ ...insider, strength: 1 });
    expect(huge.factor).toBe(1.5);
  });

  it("weights insider above an equal-strength intro path", () => {
    const a = warmPathScoreContribution({ ...insider, strength: 0.5 });
    const b = warmPathScoreContribution({ ...intro, strength: 0.5 });
    expect(a.factor).toBeGreaterThan(b.factor);
  });
});

describe("warmPathToAngle", () => {
  it("maps insider → first_degree founder-to-founder guidance", () => {
    const a = warmPathToAngle(insider, { name: "Acme" });
    expect(a?.type).toBe("first_degree");
    expect(a?.openerHint).toContain("Acme");
    expect(a?.openerHint).toContain("Alice Martin");
    expect(a?.openerHint.toLowerCase()).toContain("founder-to-founder");
  });

  it("maps intro_path → shared_connection with named connector", () => {
    const a = warmPathToAngle(intro);
    expect(a?.type).toBe("shared_connection");
    expect(a?.openerHint).toContain("Bob Durand");
    expect(a?.openerHint.toLowerCase()).toContain("warm intro");
  });

  it("degrades gracefully when connectors are unnamed (count-only plan)", () => {
    const a = warmPathToAngle({ kind: "intro_path", strength: 0.4, connectors: [] });
    expect(a?.type).toBe("shared_connection");
    expect(a?.connectors).toEqual([]);
    expect(a?.openerHint.toLowerCase()).toContain("mutual connection");
  });

  it("returns null for none", () => {
    expect(warmPathToAngle(none)).toBeNull();
    expect(warmPathToAngle(null)).toBeNull();
  });
});

describe("resolveIntroPaths", () => {
  const edges = [
    edge({ personExternalId: "m1", personName: "Mutual One" }),
    edge({ personExternalId: "m2", personName: "Mutual Two" }),
  ];
  const shared: Record<string, SharedConnections> = {
    t1: { targetExternalId: "t1", count: 1, connectorExternalIds: ["m1"] },
    t2: { targetExternalId: "t2", count: 0, connectorExternalIds: [] },
    t3: { targetExternalId: "t3", count: 2, connectorExternalIds: ["m1", "m2"] },
  };

  it("probes targets within budget and keeps only real paths", async () => {
    let calls = 0;
    const res = await resolveIntroPaths(
      { targets: [{ personExternalId: "t1" }, { personExternalId: "t2" }], edges, budget: 10 },
      {
        getSharedConnections: async (id) => {
          calls += 1;
          return shared[id];
        },
      },
    );
    expect(calls).toBe(2);
    expect(res.probed).toBe(2);
    expect(res.budgetExhausted).toBe(false);
    expect(res.paths.has("t1")).toBe(true); // has a mutual → path
    expect(res.paths.has("t2")).toBe(false); // count 0 → none, dropped
  });

  it("stops at the rate-limit budget and signals resume", async () => {
    const res = await resolveIntroPaths(
      {
        targets: [
          { personExternalId: "t1" },
          { personExternalId: "t3" },
          { personExternalId: "t2" },
        ],
        edges,
        budget: 1,
      },
      { getSharedConnections: async (id) => shared[id] },
    );
    expect(res.probed).toBe(1);
    expect(res.budgetExhausted).toBe(true);
    expect(res.paths.has("t1")).toBe(true);
  });
});

describe("buildAccountWarmPaths", () => {
  it("groups first-degree resolved edges by account, strongest first", () => {
    const edges = [
      edge({ personExternalId: "a", resolvedCompanyId: "acme" }),
      edge({ personExternalId: "b", resolvedCompanyId: "acme" }), // 2 insiders → stronger
      edge({ personExternalId: "c", resolvedCompanyId: "globex" }),
      edge({ personExternalId: "d", networkDistance: "second", resolvedCompanyId: "skip" }),
      edge({ personExternalId: "e", resolvedCompanyId: null }),
    ];
    const out = buildAccountWarmPaths(edges);
    expect(out.map((o) => o.companyId)).toEqual(["acme", "globex"]);
    expect(out[0].warmPath.strength).toBeGreaterThan(out[1].warmPath.strength);
    expect(out.every((o) => o.warmPath.kind === "insider")).toBe(true);
  });

  it("returns [] when no first-degree resolved edges exist", () => {
    expect(buildAccountWarmPaths([edge({ networkDistance: "second", resolvedCompanyId: "x" })])).toEqual([]);
  });
});
