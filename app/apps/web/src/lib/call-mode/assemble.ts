/**
 * The deterministic assembler — the intelligence that is NOT an LLM.
 *
 * `assembleScript(evidence, template, opts)` turns grounded evidence + the
 * tenant template into an ordered, methodology-shaped `AssembledScript`, marks
 * each bloc grounded/template with provenance, and runs the lever validators.
 * Same evidence + template ⇒ identical script (pure, no clock, no I/O), so it
 * is fully snapshot-testable.
 *
 * The one LLM step (insight.ts) is computed separately and passed in via
 * `opts.groundedInsight` / `opts.groundedProblemScene`; the assembler accepts a
 * grounded claim ONLY if its evidenceRef matches a real evidence id
 * (fail-closed), otherwise it falls back to the template stub.
 */

import type {
  AssembledBloc,
  AssembledScript,
  GroundedClaim,
  ProspectEvidence,
  ScriptTemplate,
} from "./types";
import { SOURCE_LABEL } from "./types";
import { validateScript } from "./levers";
import { REASON_BRIDGE } from "./live-script";
import { interpolateOpener, defaultScriptFields } from "./call-scripts";

export interface AssembleOptions {
  contactName?: string | null;
  sector?: string | null;
  geo?: string | null;
  /** The constrained LLM insight (insight.ts) — accepted only if its
   *  evidenceRef is valid for this evidence set. */
  groundedInsight?: GroundedClaim | null;
  /** The constrained LLM Tier-1 problem scene — same validation. */
  groundedProblemScene?: GroundedClaim | null;
}

const DEFAULT_MICRO_CTA = "Ça vous parle, ou vous êtes déjà au point là-dessus ?";

function evidenceIds(e: ProspectEvidence): Set<string> {
  const ids = new Set<string>();
  if (e.reason) ids.add(e.reason.id);
  if (e.problemTrigger) ids.add(e.problemTrigger.id);
  for (const i of e.insightInputs) ids.add(i.id);
  return ids;
}

/** A grounded claim is trusted only if it cites a real evidence id. */
function validClaim(claim: GroundedClaim | null | undefined, ids: Set<string>): GroundedClaim | null {
  if (!claim || !claim.text?.trim() || !ids.has(claim.evidenceRef)) return null;
  return { text: claim.text.trim(), evidenceRef: claim.evidenceRef };
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
}
function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

/** Choose the opener variant from evidence + template: heard-the-name when the
 *  tenant has a peer the prospect's sector would recognise, else the permission
 *  gate. Both are template-driven (never hardcoded vendor content). */
function chooseOpener(template: ScriptTemplate, opts: AssembleOptions): string {
  const peer = (template.peerReferences ?? []).find((p) => p.trim());
  if (peer && template.openerHeardName?.trim()) {
    return interpolateOpener(template.openerHeardName.replace(/\{peer\}/g, peer), {
      name: opts.contactName,
      sector: opts.sector,
      geo: opts.geo,
    });
  }
  return interpolateOpener(template.opener, { name: opts.contactName, sector: opts.sector, geo: opts.geo });
}

/** Pick the single Tier-1 enjeu best matching the trigger; grounded only when a
 *  real trigger actually overlapped, else the sector default (template). */
function pickEnjeu(evidence: ProspectEvidence, template: ScriptTemplate): { text: string; grounded: boolean } {
  const problems = (template.problems ?? []).filter((p) => p.trim());
  if (problems.length === 0) return { text: "", grounded: false };
  const trig = evidence.problemTrigger;
  if (trig) {
    const tw = tokens(trig.value);
    let best = problems[0];
    let bestScore = -1;
    for (const p of problems) {
      const s = overlap(tokens(p), tw);
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    return { text: best, grounded: bestScore > 0 };
  }
  return { text: problems[0], grounded: false };
}

export function assembleScript(
  evidence: ProspectEvidence,
  template: ScriptTemplate,
  opts: AssembleOptions = {},
): AssembledScript {
  const ids = evidenceIds(evidence);
  const blocs: AssembledBloc[] = [];

  // opener (permission gate or heard-the-name) — template, by construction
  blocs.push({ kind: "opener", text: chooseOpener(template, opts), grounded: false, leverIds: ["opener_permission"] });

  // reason (Bloc 2) — grounded, with provenance, or omitted
  if (evidence.reason) {
    blocs.push({
      kind: "reason",
      text: `${REASON_BRIDGE} ${evidence.reason.value}`,
      grounded: true,
      provenance: { label: SOURCE_LABEL[evidence.reason.source.kind], sourceRef: evidence.reason.id },
      leverIds: ["reason_stated"],
    });
  }

  // insight (Challenger reframe) — grounded LLM claim if cited, else stub, else omit
  const insight = validClaim(opts.groundedInsight, ids);
  if (insight) {
    blocs.push({
      kind: "insight",
      text: insight.text,
      grounded: true,
      provenance: { label: SOURCE_LABEL.dossier, sourceRef: insight.evidenceRef },
      leverIds: ["insight_present"],
    });
  } else if (template.insightStub?.trim()) {
    blocs.push({ kind: "insight", text: template.insightStub.trim(), grounded: false, leverIds: ["insight_present"] });
  }

  // problemTier1 — exactly one. Grounded scene (LLM) if cited, else the picked enjeu.
  const scene = validClaim(opts.groundedProblemScene, ids);
  const enjeu = pickEnjeu(evidence, template);
  if (scene) {
    blocs.push({
      kind: "problemTier1",
      text: scene.text,
      grounded: true,
      provenance: { label: SOURCE_LABEL.dossier, sourceRef: scene.evidenceRef },
      leverIds: ["single_tier1_problem"],
    });
  } else {
    blocs.push({
      kind: "problemTier1",
      text: enjeu.text,
      grounded: enjeu.grounded,
      provenance:
        enjeu.grounded && evidence.problemTrigger
          ? { label: SOURCE_LABEL[evidence.problemTrigger.source.kind], sourceRef: evidence.problemTrigger.id }
          : undefined,
      leverIds: ["single_tier1_problem"],
    });
  }

  // microCTA — template trial-close, never generated
  blocs.push({ kind: "microCTA", text: template.microCTA?.trim() || DEFAULT_MICRO_CTA, grounded: false, leverIds: [] });

  // ask — template de-risked ask, name interpolated, never generated
  blocs.push({
    kind: "ask",
    text: interpolateOpener(template.bookingAsk, { name: opts.contactName, sector: opts.sector, geo: opts.geo }),
    grounded: false,
    leverIds: ["ask_derisked", "guidance_over_defer", "booking_live"],
  });

  // objections — per-tenant bank (Phase 2 learns it); empty ⇒ flagged by the validator
  const objText = (template.sectorObjections ?? [])
    .filter((o) => o.objection.trim() && o.response.trim())
    .map((o) => `${o.objection} → ${o.response}`)
    .join("\n");
  if (objText.trim()) {
    blocs.push({ kind: "objections", text: objText, grounded: false, leverIds: ["objection_ready"] });
  }

  const script: AssembledScript = { blocs, gaps: { failedLevers: [] } };
  script.gaps = validateScript(script, template);
  return script;
}

/** Build the engine template from the code defaults for a sector — the seam
 *  the API + tests share until the per-tenant `blocs` jsonb (T1.4/T1.5) lands.
 *  Engine extensions left empty here are intentionally flagged by the validator
 *  (e.g. no per-tenant objection bank yet ⇒ objection_ready gap). */
export function defaultEngineTemplate(sector?: string | null): ScriptTemplate {
  return { ...defaultScriptFields(sector), sectorObjections: [], peerReferences: [] };
}
