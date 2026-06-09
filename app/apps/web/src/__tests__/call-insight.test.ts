import { describe, it, expect, vi } from "vitest";
import { generateGroundedInsight } from "@/lib/call-mode/insight";
import type { EvidenceItem, ProspectEvidence, ScriptTemplate } from "@/lib/call-mode/types";

const tmpl: ScriptTemplate = {
  opener: "",
  problems: [],
  permissionCheck: "",
  bookingAsk: "",
  guidance: [],
  product: "Logiciels open-source opérés, souverains, moins chers",
};

const ev = (inputs: EvidenceItem[]): ProspectEvidence => ({
  reason: null,
  problemTrigger: null,
  sector: "Fondation",
  persona: { title: "SG" },
  insightInputs: inputs,
  history: {},
});
const E1: EvidenceItem = { id: "E1", value: "Série B (2026)", source: { kind: "dossier", ref: "funding" }, confidence: 0.6 };

describe("generateGroundedInsight (the single, fail-closed LLM step)", () => {
  it("keeps a claim that cites a real evidence id", async () => {
    const generate = vi.fn(async () => ({ object: { insight: { text: "Le vrai coût est ailleurs.", evidenceRef: "E1" }, problemScene: null } }));
    const r = await generateGroundedInsight(ev([E1]), tmpl, { model: {}, generate } as never);
    expect(generate).toHaveBeenCalledOnce();
    expect(r.insight).toEqual({ text: "Le vrai coût est ailleurs.", evidenceRef: "E1" });
  });

  it("DROPS a claim that cites a non-existent evidence id (the fail-closed guarantee)", async () => {
    const generate = vi.fn(async () => ({ object: { insight: { text: "Vous avez levé 50M.", evidenceRef: "E9" }, problemScene: null } }));
    const r = await generateGroundedInsight(ev([E1]), tmpl, { model: {}, generate } as never);
    expect(r.insight).toBeNull();
  });

  it("validates each field independently", async () => {
    const generate = vi.fn(async () => ({ object: { insight: { text: "ok", evidenceRef: "E1" }, problemScene: { text: "bad", evidenceRef: "E2" } } }));
    const r = await generateGroundedInsight(ev([E1]), tmpl, { model: {}, generate } as never);
    expect(r.insight?.evidenceRef).toBe("E1");
    expect(r.problemScene).toBeNull();
  });

  it("does not call the model when there are no insight inputs", async () => {
    const generate = vi.fn();
    const r = await generateGroundedInsight(ev([]), tmpl, { model: {}, generate } as never);
    expect(generate).not.toHaveBeenCalled();
    expect(r).toEqual({ insight: null, problemScene: null });
  });

  it("never calls and returns nulls when no model key is configured", async () => {
    const generate = vi.fn();
    const r = await generateGroundedInsight(ev([E1]), tmpl, { model: null, generate } as never);
    expect(generate).not.toHaveBeenCalled();
    expect(r.insight).toBeNull();
  });

  it("swallows a model error — a missed insight must not crash assembly", async () => {
    const generate = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await generateGroundedInsight(ev([E1]), tmpl, { model: {}, generate } as never);
    expect(r).toEqual({ insight: null, problemScene: null });
  });
});
