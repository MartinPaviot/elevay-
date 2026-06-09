import { describe, it, expect } from "vitest";
import { buildProspectEvidence } from "@/lib/call-mode/evidence";

describe("buildProspectEvidence", () => {
  it("derives the reason from a live signal (highest confidence)", () => {
    const e = buildProspectEvidence({ signal: { type: "trial_expiring", label: "Essai expirant dans 3 jours" } });
    expect(e.reason?.value).toBe("Essai expirant dans 3 jours");
    expect(e.reason?.source.kind).toBe("signal");
    expect(e.reason?.source.ref).toBe("trial_expiring");
    expect(e.reason?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("falls back to the research angle when there is no signal", () => {
    const e = buildProspectEvidence({ dossier: { recommendedApproach: { messagingAngle: "SaaS remplaçable" } } });
    expect(e.reason?.value).toBe("SaaS remplaçable");
    expect(e.reason?.source.kind).toBe("dossier");
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
    // insight inputs carry stable ids and are all grounded dossier facts
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
      signal: { type: "trial_expiring", label: "Vieux signal", observedAt: "2020-01-01T00:00:00Z" },
    });
    expect(e.reason).toBeNull();
  });

  it("passes sector + persona through", () => {
    const e = buildProspectEvidence({ sector: "Fondation", persona: { title: "Secrétaire général" } });
    expect(e.sector).toBe("Fondation");
    expect(e.persona.title).toBe("Secrétaire général");
  });
});
