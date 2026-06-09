import { describe, it, expect } from "vitest";
import { buildProspectEvidence } from "@/lib/call-mode/evidence";

describe("buildProspectEvidence", () => {
  it("derives the reason from a voiceable live signal (highest confidence)", () => {
    const e = buildProspectEvidence({ signal: { type: "hiring", label: "Recrute 4 commerciaux" } });
    expect(e.reason?.value).toBe("Recrute 4 commerciaux");
    expect(e.reason?.source.kind).toBe("signal");
    expect(e.reason?.source.ref).toBe("hiring");
    expect(e.reason?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("ignores an internal signal type and falls to a dossier event", () => {
    const e = buildProspectEvidence({
      signal: { type: "engagement_spike", label: "Pic d'engagement" },
      dossier: { funding: { lastRound: "Série B" } },
    });
    expect(e.reason?.source.kind).toBe("dossier");
    expect(e.reason?.value).toBe("Série B");
  });

  it("does NOT voice a messaging angle — it is a strategy note, not a reason", () => {
    const e = buildProspectEvidence({ dossier: { recommendedApproach: { messagingAngle: "Insister sur le coût" } } });
    expect(e.reason).toBeNull();
  });

  it("selects the problem trigger from the tech stack and exposes insight inputs", () => {
    const e = buildProspectEvidence({
      dossier: {
        techStack: ["Salesforce", "SAP"],
        hiringSignals: [{ role: "DSI" }],
        funding: { lastRound: "Série B", date: "2026" },
      },
    });
    expect(e.problemTrigger?.source.ref).toBe("techStack");
    expect(e.problemTrigger?.value).toContain("Salesforce");
    const ids = e.insightInputs.map((i) => i.id);
    expect(ids).toEqual([...new Set(ids)]); // unique
    expect(e.insightInputs.some((i) => i.value.includes("Série B"))).toBe(true);
    expect(e.insightInputs.some((i) => i.source.ref === "techStack")).toBe(true);
  });

  it("returns all-null evidence for an empty brain — nothing to ground", () => {
    const e = buildProspectEvidence({});
    expect(e.reason).toBeNull();
    expect(e.problemTrigger).toBeNull();
    expect(e.insightInputs).toEqual([]);
  });

  it("drops a stale signal rather than presenting it as 'now'", () => {
    const e = buildProspectEvidence({
      signal: { type: "hiring", label: "Vieux recrutement", observedAt: "2020-01-01T00:00:00Z" },
    });
    expect(e.reason).toBeNull();
  });

  it("passes sector + persona through", () => {
    const e = buildProspectEvidence({ sector: "Fondation", persona: { title: "Secrétaire général" } });
    expect(e.sector).toBe("Fondation");
    expect(e.persona.title).toBe("Secrétaire général");
  });
});
