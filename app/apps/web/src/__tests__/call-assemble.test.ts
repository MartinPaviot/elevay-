import { describe, it, expect } from "vitest";
import { assembleScript } from "@/lib/call-mode/assemble";
import type { ProspectEvidence, ScriptTemplate } from "@/lib/call-mode/types";

const T: ScriptTemplate = {
  opener: "Bonjour {name}, vous avez deux minutes ?",
  problems: [
    "le budget logiciels rogne sur la mission",
    "des outils Salesforce en place qu'on remplace à l'identique pour moins cher",
  ],
  permissionCheck: "C'est un sujet chez vous ?",
  bookingAsk:
    "45 minutes : vous repartez avec une première lecture même si on ne bosse jamais ensemble. Mardi 14h ou jeudi matin ?",
  guidance: [],
  posture: "challenger",
  microCTA: "Ça vous parle ?",
  insightStub: "Insight par défaut.",
  sectorObjections: [{ objection: "On a déjà un outil", response: "on mesure l'écart en 45 min" }],
};

const fullEvidence: ProspectEvidence = {
  reason: { id: "reason", value: "Essai expirant dans 3 jours", source: { kind: "signal", ref: "trial" }, confidence: 0.9 },
  problemTrigger: { id: "trigger", value: "Outils en place : Salesforce", source: { kind: "dossier", ref: "techStack" }, confidence: 0.6 },
  sector: "Fondation",
  persona: { title: "Secrétaire général" },
  insightInputs: [{ id: "E1", value: "Série B (2026)", source: { kind: "dossier", ref: "funding" }, confidence: 0.6 }],
  history: {},
};
const emptyEvidence: ProspectEvidence = {
  reason: null,
  problemTrigger: null,
  sector: null,
  persona: {},
  insightInputs: [],
  history: {},
};

const kinds = (s: ReturnType<typeof assembleScript>) => s.blocs.map((b) => b.kind);

describe("assembleScript", () => {
  it("is deterministic — same evidence + template ⇒ identical script", () => {
    const a = assembleScript(fullEvidence, T, { contactName: "Marie" });
    const b = assembleScript(fullEvidence, T, { contactName: "Marie" });
    expect(a).toEqual(b);
  });

  it("grounding invariant: every provenance.sourceRef is a real evidence id", () => {
    const ids = new Set(["reason", "trigger", "E1"]);
    const s = assembleScript(fullEvidence, T, { contactName: "Marie" });
    for (const b of s.blocs) {
      if (b.provenance) expect(ids.has(b.provenance.sourceRef)).toBe(true);
      if (b.grounded) expect(b.provenance).toBeDefined();
    }
  });

  it("emits exactly one Tier-1 problem, grounded on the matching trigger", () => {
    const s = assembleScript(fullEvidence, T);
    const problems = s.blocs.filter((b) => b.kind === "problemTier1");
    expect(problems).toHaveLength(1);
    expect(problems[0].text).toContain("Salesforce"); // picked by trigger overlap, not problems[0]
    expect(problems[0].grounded).toBe(true);
    expect(problems[0].provenance?.sourceRef).toBe("trigger");
  });

  it("renders the grounded reason with provenance", () => {
    const s = assembleScript(fullEvidence, T);
    const reason = s.blocs.find((b) => b.kind === "reason");
    expect(reason?.grounded).toBe(true);
    expect(reason?.text).toContain("Essai expirant dans 3 jours");
    expect(reason?.provenance?.sourceRef).toBe("reason");
  });

  it("accepts a grounded insight that cites a real id, drops one that does not", () => {
    const good = assembleScript(fullEvidence, T, { groundedInsight: { text: "Le vrai coût est ailleurs.", evidenceRef: "E1" } });
    const gi = good.blocs.find((b) => b.kind === "insight");
    expect(gi?.grounded).toBe(true);
    expect(gi?.text).toBe("Le vrai coût est ailleurs.");

    const bogus = assembleScript(fullEvidence, T, { groundedInsight: { text: "Inventé.", evidenceRef: "E9" } });
    const bi = bogus.blocs.find((b) => b.kind === "insight");
    expect(bi?.grounded).toBe(false); // fell back to the template stub
    expect(bi?.text).toBe("Insight par défaut.");
  });

  it("suppresses the insight bloc for the consultative posture (no Challenger reframe)", () => {
    const consultative: ScriptTemplate = { ...T, posture: "consultative" };
    const s = assembleScript(fullEvidence, consultative, { groundedInsight: { text: "Reframe contrariant.", evidenceRef: "E1" } });
    expect(s.blocs.find((b) => b.kind === "insight")).toBeUndefined();
    // the rest of the script still assembles
    expect(s.blocs.find((b) => b.kind === "problemTier1")).toBeDefined();
  });

  it("uses a grounded problem scene when cited", () => {
    const s = assembleScript(fullEvidence, T, { groundedProblemScene: { text: "Votre équipe paie Salesforce sans le piloter.", evidenceRef: "trigger" } });
    const p = s.blocs.find((b) => b.kind === "problemTier1");
    expect(p?.grounded).toBe(true);
    expect(p?.text).toContain("Salesforce sans le piloter");
  });

  it("with no evidence: opener + template blocs only, no invented reason", () => {
    const s = assembleScript(emptyEvidence, T, { contactName: "Marie" });
    expect(s.blocs.find((b) => b.kind === "reason")).toBeUndefined();
    expect(kinds(s)).toContain("opener");
    expect(kinds(s)).toContain("ask");
    const p = s.blocs.find((b) => b.kind === "problemTier1");
    expect(p?.grounded).toBe(false); // template default, not invented
  });

  it("uses the heard-the-name opener when the tenant has a peer + a variant template", () => {
    const withPeer: ScriptTemplate = { ...T, peerReferences: ["la Fondation X"], openerHeardName: "Bonjour {name}, on bosse avec {peer} — mon nom vous dit quelque chose ?" };
    const s = assembleScript(fullEvidence, withPeer, { contactName: "Marie" });
    expect(s.blocs[0].text).toContain("la Fondation X");
  });

  it("computes lever gaps (compliant template ⇒ none; empty objections ⇒ flagged)", () => {
    expect(assembleScript(fullEvidence, T).gaps.failedLevers).toEqual([]);
    const noObj: ScriptTemplate = { ...T, sectorObjections: [] };
    expect(assembleScript(fullEvidence, noObj).gaps.failedLevers.map((f) => f.id)).toContain("objection_ready");
  });
});
