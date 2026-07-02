/**
 * Spec 19/20 — grounded-copy SHADOW. Runs the spec-18/19 copy engine over a live
 * prospect (assets+voice from the spec-18 store, evidence from the prospect
 * context) and stores the result for comparison against the live draft path. The
 * shadow NEVER replaces a live send — it's the data the founder reads to decide a
 * cutover. Behind COPY_ENGINE_SHADOW (off). The model call is injectable so the
 * pipeline is testable without the network; generateMessage enforces the
 * never-invent post-check, so a thin/ungrounded result is a flagged fallback, not
 * a hallucination.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db as defaultDb } from "@/db";
import { copyShadowSample } from "@/db/schema";
import { buildProspectContext } from "@/lib/context/prospect-context";
import { copyContextForTenant } from "@/lib/copy/assets/db-store";
import { decideFabricationGate, type FabricationInput } from "@/lib/evals/fabrication-gate";
import { GATE_RUBRICS, recordGateDecision } from "@/lib/gates/gate-decisions";
import { prospectContextToEvidence } from "./db-evidence";
import {
  generateMessage,
  type Lang,
  type Message,
  type PersonalizationAgentInput,
  type PersonalizationAgentResult,
} from "./generate-message";

/** Whether the copy-engine shadow is enabled. Default OFF — runs an LLM per sample. */
export function isCopyShadowEnabled(): boolean {
  const v = process.env.COPY_ENGINE_SHADOW;
  return v === "1" || v === "true";
}

export type ShadowGenerate = (args: { system: string; user: string }) => Promise<string>;

const defaultGenerate: ShadowGenerate = async ({ system, user }) => {
  const anthropic = new Anthropic();
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 800,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content[0]?.type === "text" ? res.content[0].text : "";
};

const SYSTEM_PROMPT = `You write ONE personalization line for a cold outreach email, grounded ONLY in the cited evidence provided. Rules:
- Reference a SPECIFIC fact from the evidence; cite the evidence id(s) you used in citedIds.
- NEVER invent a detail. If no evidence is specific enough, return an empty line and citedIds [].
- Obey the voice guide: never use any banned token; for French use vouvoiement unless told otherwise.
- One or two sentences, no greeting, no sign-off.
Output ONLY valid JSON: { "line": "<the personalization line>", "subject": "<optional subject>", "citedIds": ["<evidence id>", ...] }`;

/** Build the agent prompt from assets + voice + evidence. */
export function buildAgentPrompt(input: PersonalizationAgentInput): { system: string; user: string } {
  const parts: string[] = [];
  parts.push(`Language: ${input.lang}${input.lang === "fr" ? " (vouvoiement)" : ""}`);
  if (input.roleClass) parts.push(`Recipient role: ${input.roleClass}`);
  parts.push("\n## Our positioning / offer (for tone, do not copy verbatim)");
  parts.push([input.assets.positioning, input.assets.offer].filter(Boolean).join("\n") || "(none)");
  parts.push("\n## Voice");
  parts.push(`Banned tokens: ${input.voice.banned.join(", ") || "(none)"}`);
  if (input.voice.favoredPhrasings?.length) parts.push(`Favored phrasings: ${input.voice.favoredPhrasings.join(", ")}`);
  parts.push("\n## Evidence (cite by id; never state anything not here)");
  for (const c of input.evidence) parts.push(`- [${c.id}] (${c.source}, conf ${c.confidence.toFixed(2)}): ${c.fact}`);
  return { system: SYSTEM_PROMPT, user: parts.join("\n") };
}

/** The spec-04-shaped personalization agent. Model error/unparseable → non-result (falls back). */
export async function personalizationRunAgent(
  input: PersonalizationAgentInput,
  generate: ShadowGenerate = defaultGenerate,
): Promise<PersonalizationAgentResult> {
  try {
    const raw = await generate(buildAgentPrompt(input));
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { evalPassed: false, reason: "no_json" };
    const parsed = JSON.parse(match[0]) as { line?: unknown; subject?: unknown; citedIds?: unknown };
    if (typeof parsed.line !== "string" || !Array.isArray(parsed.citedIds)) return { evalPassed: false, reason: "bad_shape" };
    return {
      evalPassed: true,
      value: {
        line: parsed.line,
        subject: typeof parsed.subject === "string" ? parsed.subject : undefined,
        citedIds: parsed.citedIds.filter((x): x is string => typeof x === "string"),
      },
    };
  } catch (e) {
    return { evalPassed: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export interface ShadowOutcome {
  ran: boolean;
  /** "no_prospect_context" | "copy_shadow_disabled" | "g2_fabrication_blocked" */
  reason?: string;
  message?: Message;
  evidenceCount?: number;
  /** T6b — the caller-verified whitelist this message was gated against
   *  (evidence facts + tenant asset text). The insert-seam re-gate passes it
   *  through as extraGroundTruth so a source-gate PASS is never re-flagged by
   *  a weaker whitelist. */
  groundTruth?: string[];
}

/** Whether the grounded copy engine is the PRIMARY draft path (cutover). Default OFF. */
export function isCopyEnginePrimaryEnabled(): boolean {
  const v = process.env.COPY_ENGINE_PRIMARY;
  return v === "1" || v === "true";
}

/**
 * Core: run the copy engine for a contact and return the message — NO flag gate,
 * NO persist. Used by both the shadow (gated + persisted) and the primary cutover
 * (where the high-personalization message becomes the live draft). Returns
 * ran:false only when the prospect context is missing; ran:true WITHOUT a message
 * when the G2 factual gate blocks (reason "g2_fabrication_blocked") — every
 * consumer treats an absent message as "keep the legacy personalisation".
 */
export async function generateCopyMessage(
  contactId: string,
  tenantId: string,
  opts: { lang?: Lang; campaignId?: string | null; generate?: ShadowGenerate; database?: typeof defaultDb } = {},
): Promise<ShadowOutcome> {
  const database = opts.database ?? defaultDb;
  const lang: Lang = opts.lang ?? "en";

  const ctx = await buildProspectContext(contactId, tenantId);
  if (!ctx) return { ran: false, reason: "no_prospect_context" };

  const evidence = prospectContextToEvidence(ctx);
  const copyCtx = await copyContextForTenant(tenantId, { lang, campaignId: opts.campaignId ?? null }, database);

  const message = await generateMessage({
    assets: copyCtx.assets,
    voice: {
      banned: copyCtx.voice?.banned ?? [],
      frFormality: copyCtx.voice?.frFormality ?? "vouvoiement",
      favoredPhrasings: copyCtx.voice?.favoredPhrasings,
    },
    evidence,
    roleClass: ctx.contact.seniority ?? undefined,
    lang,
    runAgent: (input) => personalizationRunAgent(input, opts.generate),
    winningFormats: copyCtx.voice?.formats,
  });

  // M13 T6b — G2 factual gate at the copy-engine SOURCE, so every consumer
  // (autopilot prepare, draft-router primary, auto-send, V2 conductor, shadow)
  // inherits it with zero call-site changes. DETERMINISTIC layer only at this
  // seam — this core runs on bulk paths, so the SEMANTIC judge (one Haiku call
  // per draft) stays on the sequence-generator path. Prospect/brief assembly is
  // fail-soft (a throw = no brief = the strict empty-brief posture); the verdict
  // itself is fail-closed: a blocked body never leaves this function.
  // ctx is non-null here (checked above); no brief = the strict empty-brief
  // posture on the gate call below.
  const prospect: FabricationInput["prospect"] = {
    name: ctx.contact?.fullName,
    title: ctx.contact?.title,
    company: ctx.company?.name,
    domain: ctx.company?.domain,
  };
  // The engine grounds on ctx.funding/technologies (evidence OUTSIDE the
  // researchBrief) and bakes tenant asset text into the body (assembleBody:
  // positioning+offer+cta). Both are CALLER-verified ground truth — whitelist
  // them so the gate flags fabrication, not the engine's own grounding. The
  // subject is gated WITH the body: it ships verbatim at every cutover site.
  const groundTruth = [
    ...evidence.map((e) => e.fact),
    copyCtx.assets.positioning ?? "",
    copyCtx.assets.offer ?? "",
    copyCtx.assets.cta ?? "",
  ].filter(Boolean);
  const fab = decideFabricationGate({
    body: [message.subject, message.body].filter(Boolean).join("\n"),
    brief: ctx.researchBrief,
    prospect,
    extraGroundTruth: groundTruth,
  });
  // Verdict log — best-effort by contract (recordGateDecision never throws);
  // honors the module's injection seam like persistShadowSample.
  await recordGateDecision(
    {
      tenantId,
      subjectType: "step",
      subjectId: contactId,
      gate: 2,
      rubricVersion: GATE_RUBRICS.g2Deterministic,
      verdict: fab.blocked ? "blocked" : "pass",
      reasons: { ungrounded: fab.ungrounded.slice(0, 8), briefHasFacts: fab.briefHasFacts, path: "copy_engine" },
    },
    database,
  );
  if (fab.blocked) {
    // Absent message = the fallback every caller already handles: the cutover
    // sites require `out.message` + personalization_level "high" and keep the
    // legacy personalisation otherwise; the shadow skips the persist; the
    // autopilot discards the outcome. No consumer special-cases the block.
    return { ran: true, reason: "g2_fabrication_blocked", evidenceCount: evidence.length };
  }

  return { ran: true, message, evidenceCount: evidence.length, groundTruth };
}

/**
 * Generate one grounded shadow sample for a contact and persist it (behind
 * COPY_ENGINE_SHADOW). Returns ran:false when disabled or no context.
 */
export async function generateShadowCopy(
  contactId: string,
  tenantId: string,
  opts: { lang?: Lang; campaignId?: string | null; generate?: ShadowGenerate; database?: typeof defaultDb } = {},
): Promise<ShadowOutcome> {
  if (!isCopyShadowEnabled()) return { ran: false, reason: "copy_shadow_disabled" };
  const out = await generateCopyMessage(contactId, tenantId, opts);
  if (out.ran && out.message) {
    await persistShadowSample(tenantId, contactId, opts.lang ?? "en", out.message, out.evidenceCount ?? 0, opts.database ?? defaultDb);
  }
  return out;
}

/** Persist a shadow sample (best-effort — a logging failure must not surface as a sample error). */
export async function persistShadowSample(
  tenantId: string,
  contactId: string,
  lang: Lang,
  message: Message,
  evidenceCount: number,
  database: typeof defaultDb = defaultDb,
): Promise<void> {
  try {
    await database.insert(copyShadowSample).values({
      tenantId,
      contactId,
      lang,
      personalizationLevel: message.personalization_level,
      subject: message.subject ?? null,
      body: message.body,
      flags: message.flags,
      evidenceCount,
    });
  } catch {
    /* best-effort */
  }
}
