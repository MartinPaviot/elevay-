import { describe, it, expect } from "vitest";
import { validateScript } from "@/lib/call-mode/levers";
import type { AssembledBloc, AssembledScript, LeverId, ScriptTemplate } from "@/lib/call-mode/types";

function mk(blocs: Array<Partial<AssembledBloc> & { kind: AssembledBloc["kind"] }>): AssembledScript {
  return {
    blocs: blocs.map((b) => ({ grounded: false, leverIds: [], text: "", ...b })),
    gaps: { failedLevers: [] },
  };
}
const tmpl = (over: Partial<ScriptTemplate> = {}): ScriptTemplate => ({
  opener: "Bonjour {name}, vous avez deux minutes ?",
  problems: ["le budget logiciels rogne sur la mission"],
  permissionCheck: "C'est un sujet chez vous ?",
  bookingAsk: "x",
  guidance: [],
  ...over,
});
const fails = (s: AssembledScript, t = tmpl()): LeverId[] =>
  validateScript(s, t).failedLevers.map((f) => f.id);

const compliant = mk([
  { kind: "opener", text: "Bonjour Marie, vous avez deux minutes ?" },
  { kind: "problemTier1", text: "le budget logiciels rogne sur la mission" },
  {
    kind: "ask",
    text: "45 minutes : vous repartez avec une première lecture même si on ne bosse jamais ensemble. Mardi 14h ou jeudi matin ?",
  },
  { kind: "objections", text: "On a déjà un outil → on mesure l'écart en 45 min." },
]);

describe("validateScript", () => {
  it("passes a compliant script with no gaps", () => {
    expect(validateScript(compliant, tmpl()).failedLevers).toEqual([]);
  });

  it("flags the banned opener pattern", () => {
    const s = mk([
      { kind: "opener", text: "Bonjour, je vous prends à un mauvais moment ?" },
      ...compliant.blocs.slice(1),
    ]);
    expect(fails(s)).toContain("opener_permission");
  });

  it("flags an opener that lists the problems", () => {
    const s = mk([
      { kind: "opener", text: "Bonjour, le budget logiciels rogne sur la mission, vous avez 2 min ?" },
      ...compliant.blocs.slice(1),
    ]);
    expect(fails(s)).toContain("opener_permission");
  });

  it("requires exactly one Tier-1 problem", () => {
    const two = mk([compliant.blocs[0], { kind: "problemTier1", text: "a" }, { kind: "problemTier1", text: "b" }, compliant.blocs[2], compliant.blocs[3]]);
    const zero = mk([compliant.blocs[0], compliant.blocs[2], compliant.blocs[3]]);
    expect(fails(two)).toContain("single_tier1_problem");
    expect(fails(zero)).toContain("single_tier1_problem");
  });

  it("flags an ask with no binary slot", () => {
    const s = mk([compliant.blocs[0], compliant.blocs[1], { kind: "ask", text: "On se cale 45 minutes pour vous présenter la solution." }, compliant.blocs[3]]);
    expect(fails(s)).toContain("ask_derisked");
  });

  it("accepts a binary ask de-risked via the template clause", () => {
    const s = mk([compliant.blocs[0], compliant.blocs[1], { kind: "ask", text: "Mardi 14h ou jeudi matin ?" }, compliant.blocs[3]]);
    expect(fails(s, tmpl({ askReversibility: "sans engagement" }))).not.toContain("ask_derisked");
  });

  it("flags a deferring ask even when otherwise valid", () => {
    const s = mk([
      compliant.blocs[0],
      compliant.blocs[1],
      { kind: "ask", text: "Mardi 14h ou jeudi matin, vous repartez avec une première lecture. Sinon, quelles sont vos disponibilités ?" },
      compliant.blocs[3],
    ]);
    expect(fails(s)).toContain("guidance_over_defer");
  });

  it("flags a missing objection bank", () => {
    const s = mk([compliant.blocs[0], compliant.blocs[1], compliant.blocs[2]]);
    expect(fails(s)).toContain("objection_ready");
  });
});
