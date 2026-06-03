/**
 * Signal → opener generator (gap D, _specs/multi-icp + cold-call flow).
 *
 * Closes the gap where SIGNAL_ANGLES + METHODOLOGIES existed but nothing
 * fused a company's ACTUAL fired signals + the tenant's ICP/product +
 * the contact's seniority into concrete opening copy.
 *
 * Pure — no DB, no LLM, fully testable. Produces a grounded opener
 * deterministically (so it works even when the LLM endpoint is
 * unreachable); an optional LLM polish can wrap the output later.
 */

import {
  getMethodology,
  pickBestSignal,
  SIGNAL_ANGLES,
  type SignalAngle,
} from "./outbound-methodologies";

/** A company's fired TAM signals (companies.properties.tamSignals). */
export interface TamSignalBundle {
  [key: string]: { value?: boolean; reason?: string; confidence?: string } | null | undefined;
}

/** TAM signal key → SIGNAL_ANGLES taxonomy key. */
const TAM_SIGNAL_TO_ANGLE: Record<string, string> = {
  funding_recent: "funding",
  funding_crunchbase: "funding",
  investor_overlap: "funding",
  hiring_intent: "hiring",
  yc_company: "news",
};

function confidenceToRelevance(c: string | undefined): "high" | "medium" | "low" {
  const s = (c ?? "").toLowerCase();
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}

/** Flatten a fired-signal bundle into the shape pickBestSignal expects. */
export function tamSignalsToAngleSignals(
  bundle: TamSignalBundle | null | undefined,
): Array<{ type: string; relevance: "high" | "medium" | "low"; title: string; description: string; dataSource?: string }> {
  if (!bundle) return [];
  const out: Array<{ type: string; relevance: "high" | "medium" | "low"; title: string; description: string }> = [];
  for (const [key, sig] of Object.entries(bundle)) {
    if (!sig || sig.value !== true) continue;
    const angleType = TAM_SIGNAL_TO_ANGLE[key];
    if (!angleType) continue;
    out.push({
      type: angleType,
      relevance: confidenceToRelevance(sig.confidence),
      title: key,
      description: sig.reason ?? "",
    });
  }
  return out;
}

export interface OpenerInput {
  companyName: string;
  contactTitle?: string | null;
  seniority?: string | null;
  /** Fired signals — pass tamSignalsToAngleSignals(company.properties.tamSignals). */
  signals: Array<{ type: string; relevance: "high" | "medium" | "low"; title: string; description: string }>;
  /** What the tenant sells — drives painPoint / inferredArea inference. */
  product?: string | null;
  icpIndustry?: string | null;
  /** Template fill values when known; sensible fallbacks otherwise. */
  fields?: {
    fundingDetail?: string | null;
    inferredArea?: string | null;
    painPoint?: string | null;
    department?: string | null;
    inferredPain?: string | null;
    technology?: string | null;
    specificChallenge?: string | null;
    companyStage?: string | null;
    geography?: string | null;
    expansionChallenge?: string | null;
    role?: string | null;
    category?: string | null;
    newsEvent?: string | null;
    implication?: string | null;
    area?: string | null;
  };
}

export interface GeneratedOpener {
  /** TAM signal key used (e.g. "funding_recent"), or null when no signal fired. */
  signalUsed: string | null;
  /** Angle taxonomy key (funding/hiring/...), or null. */
  angle: string | null;
  methodology: string;
  maxWords: number;
  /** The composed, ready-to-edit opener. */
  opener: string;
  businessImplication: string | null;
  /** What NOT to do, from the seniority methodology. */
  guardrails: string[];
  cta: string;
}

/** Replace {placeholders} with provided values; strip any unfilled ones
 * to a neutral phrase so no raw "{x}" ever leaks into copy. */
function fillTemplate(tpl: string, vars: Record<string, string | null | undefined>, companyName: string): string {
  let out = tpl.replace(/\{company\}/g, companyName);
  out = out.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = vars[key];
    return v && v.trim() ? v : "this";
  });
  // Tidy any double spaces from blank substitutions.
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Generate a grounded opener from a company's fired signals + the
 * contact's seniority methodology + tenant product context.
 * Deterministic. When no signal fired, returns a methodology-shaped
 * opener that leans on the ICP/product instead of a trigger.
 */
export function generateOpener(input: OpenerInput): GeneratedOpener {
  const methodology = getMethodology(input.seniority);
  const f = input.fields ?? {};

  // Fallbacks inferred from product/industry so templates never read "this".
  const inferredArea = f.inferredArea ?? (input.product ? `your ${input.product} roadmap` : "your roadmap");
  const painPoint = f.painPoint ?? "the work compounding faster than the team";
  const vars: Record<string, string | null | undefined> = {
    fundingDetail: f.fundingDetail ?? "your recent raise",
    inferredArea,
    painPoint,
    department: f.department ?? "the team",
    inferredPain: f.inferredPain ?? painPoint,
    technology: f.technology,
    specificChallenge: f.specificChallenge ?? painPoint,
    companyStage: f.companyStage ?? "your stage",
    geography: f.geography,
    expansionChallenge: f.expansionChallenge ?? "operational complexity",
    role: f.role ?? input.contactTitle ?? "the new leader",
    category: f.category ?? (input.product ? input.product : "the category"),
    newsEvent: f.newsEvent,
    implication: f.implication ?? "new priorities",
    area: f.area ?? inferredArea,
  };

  const best = pickBestSignal(input.signals);
  if (best) {
    const angle: SignalAngle | undefined = SIGNAL_ANGLES[best.type];
    if (angle) {
      const line = fillTemplate(angle.angleTemplate, vars, input.companyName);
      const question = fillTemplate(angle.questionSeed, vars, input.companyName);
      return {
        signalUsed: best.title,
        angle: best.type,
        methodology: methodology.name,
        maxWords: methodology.maxWords,
        opener: `${line} ${question}`.trim(),
        businessImplication: angle.businessImplication,
        guardrails: methodology.whatNotToDo,
        cta: methodology.ctaType,
      };
    }
  }

  // No usable signal — fall back to the methodology's example shape,
  // grounded in the company + product rather than a trigger.
  const fallback = fillTemplate(methodology.exampleOpener, vars, input.companyName);
  return {
    signalUsed: null,
    angle: null,
    methodology: methodology.name,
    maxWords: methodology.maxWords,
    opener: fallback,
    businessImplication: null,
    guardrails: methodology.whatNotToDo,
    cta: methodology.ctaType,
  };
}
