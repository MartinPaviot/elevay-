/**
 * M12-R1 (outreach-autopilot T7) — the single writer for `outreach_decisions`:
 * one row per OUTREACH email send, the learning unit, written AT TRANSPORT
 * immediately after the shared sending gate (evaluateSend) returns
 * { send: true }. A REPLY-class send records NOTHING — answering a prospect
 * who wrote to us is not prospecting (INV-1).
 *
 * BEST-EFFORT BY CONTRACT (the exact lib/gates/gate-decisions.ts contract): a
 * learning record must never block or fail a send. EVERYTHING — including the
 * `@/db/schema` and `drizzle-orm` export accesses, which THROW under a
 * partially mocked module in tests — sits inside try/catch, so the writer
 * self-neutralizes to a no-op wherever its dependencies are absent. Callers
 * never await-and-branch on the result.
 *
 * Dedup (Inngest retry safety): `outbound_email_id` carries a partial UNIQUE
 * index and the insert is ON CONFLICT DO NOTHING, so a replayed send step
 * writes EXACTLY one record per outbound row (C1/C2/C3, and C4 which
 * generates the outbound id client-side). C5 (meeting follow-up) queues no
 * outbound row: its dedup key is NULL and duplicate-risk is tolerated there —
 * the route's own followUpSentAt 409 guard is the effective once-only rail.
 */

import { db } from "@/db";
import {
  companies,
  contacts,
  gateDecisions,
  outreachDecisions,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { filterFreshSignals } from "@/lib/signals/freshness";
import { extractMessageFeatures } from "@/lib/emails/message-features";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecordOutreachDecisionInput {
  tenantId: string;
  /** The class evaluateSend resolved (success outcome `sendClass`). Anything
   *  but "outreach" — including undefined from a legacy/mocked gate — records
   *  nothing. Never re-derive this at a chokepoint; the gate is authoritative
   *  (it downgrades unverifiable reply claims to outreach). */
  sendClass?: string;
  contactId?: string | null;
  /** Resolved from the contact's company when omitted. */
  companyId?: string | null;
  enrollmentId?: string | null;
  stepIndex?: number | null;
  /** outbound_emails.id when the chokepoint has one — the dedup key. */
  outboundEmailId?: string | null;
  /** Reserved for the deferred G5 'send'-row join (subjectId is the
   *  contactId/address there) — not stored as a column in v1. */
  toAddress?: string | null;
  subject?: string | null;
  bodyText?: string | null;
  /** Defaults to "email" — the only transport wired in v1. */
  channel?: string;
}

/** Signal entries as stored on companies.properties.signals[]
 *  (lib/signals/record-signal.ts SignalEntry). */
interface StoredSignal {
  type: string;
  detectedAt?: string | null;
  source?: string | null;
}

/**
 * Pure: the FRESHEST signal snapshot from a company's signals array — the
 * freshness filter (lib/signals/freshness.ts TTLs) drops stale entries, then
 * the most recently detected wins (undated entries, kept by the conservative
 * freshness rule, sort last). Null when nothing fresh remains.
 */
function freshestSignal(
  raw: unknown,
  now: Date = new Date(),
): Record<string, unknown> | null {
  if (!Array.isArray(raw)) return null;
  const entries = raw.filter(
    (s): s is StoredSignal =>
      !!s && typeof (s as StoredSignal).type === "string",
  );
  const fresh = filterFreshSignals(entries, now);
  if (fresh.length === 0) return null;
  const sorted = [...fresh].sort(
    (a, b) =>
      (Date.parse(b.detectedAt ?? "") || 0) -
      (Date.parse(a.detectedAt ?? "") || 0),
  );
  const top = sorted[0];
  const ts = Date.parse(top.detectedAt ?? "");
  const freshnessDays = Number.isFinite(ts)
    ? Math.max(0, Math.floor((now.getTime() - ts) / DAY_MS))
    : null;
  return {
    type: top.type,
    detected_at: top.detectedAt ?? null,
    source: top.source ?? null,
    freshness_days: freshnessDays,
  };
}

/**
 * Record one outreach decision. Returns rows written (0 on skip/failure) —
 * callers must never branch on it. See the module contract above.
 */
export async function recordOutreachDecision(
  input: RecordOutreachDecisionInput,
  database: Pick<typeof db, "select" | "insert"> = db,
): Promise<number> {
  try {
    // The learning unit is the outreach decision. A reply — and an unknown
    // class from a legacy caller — records nothing (M12-R1 Done criteria).
    if (input.sendClass !== "outreach") return 0;

    // ── Persona + signal snapshot at send (one contacts→companies join). ──
    // Missing contact / company / fields degrade to nulls, never throw.
    let persona: Record<string, unknown> | null = null;
    let signal: Record<string, unknown> | null = null;
    let companyId: string | null = input.companyId ?? null;
    try {
      if (input.contactId) {
        const [row] = await database
          .select({
            title: contacts.title,
            contactProps: contacts.properties,
            contactCompanyId: contacts.companyId,
            companySize: companies.size,
            companyIndustry: companies.industry,
            companyProps: companies.properties,
          })
          .from(contacts)
          .leftJoin(companies, eq(contacts.companyId, companies.id))
          .where(
            and(
              eq(contacts.id, input.contactId),
              eq(contacts.tenantId, input.tenantId),
            ),
          )
          .limit(1);
        if (row) {
          companyId = companyId ?? row.contactCompanyId ?? null;
          const props = (row.contactProps ?? {}) as Record<string, unknown>;
          persona = {
            seniority:
              typeof props.seniority === "string" ? props.seniority : null,
            function: row.title ?? null,
            company_size: row.companySize ?? null,
            sector: row.companyIndustry ?? null,
            // v1: no standard maturity field exists on companies.
            maturity: null,
          };
          const cProps = (row.companyProps ?? {}) as Record<string, unknown>;
          signal = freshestSignal(cProps.signals);
        }
      } else if (companyId) {
        // No contact in scope (interactive sends) but a company is — company
        // half of the persona + the signal context still apply.
        const [co] = await database
          .select({
            size: companies.size,
            industry: companies.industry,
            props: companies.properties,
          })
          .from(companies)
          .where(
            and(
              eq(companies.id, companyId),
              eq(companies.tenantId, input.tenantId),
            ),
          )
          .limit(1);
        if (co) {
          persona = {
            seniority: null,
            function: null,
            company_size: co.size ?? null,
            sector: co.industry ?? null,
            maturity: null,
          };
          signal = freshestSignal(
            ((co.props ?? {}) as Record<string, unknown>).signals,
          );
        }
      }
    } catch {
      // Lookup failed (or schema mocked away in a test) — nulls, keep going.
      persona = null;
      signal = null;
    }

    // ── Gate-score snapshot v1: the G2/G4 verdicts logged against THIS ──
    // outbound row (gate_decisions rows already exist at transport time:
    // subject_type 'draft', subject_id = the outbound row id, written at the
    // enqueueOutbound seam). DEFERRED: the G5 transport verdict is logged by
    // evaluateSend under subject_type 'send' keyed by contactId/toAddress
    // with no row linkage — joining it needs a shared subject key (v1 gap,
    // documented; the gateScores.g5 slot stays null until then).
    let gateScores: Record<string, unknown> | null = null;
    try {
      if (input.outboundEmailId) {
        const rows = await database
          .select({
            gate: gateDecisions.gate,
            score: gateDecisions.score,
            verdict: gateDecisions.verdict,
          })
          .from(gateDecisions)
          .where(
            and(
              eq(gateDecisions.tenantId, input.tenantId),
              eq(gateDecisions.subjectType, "draft"),
              eq(gateDecisions.subjectId, input.outboundEmailId),
            ),
          )
          // "Last verdict per gate" must be deterministic — without an ORDER BY
          // Postgres returns arbitrary order and a reworked draft's snapshot
          // could capture the superseded verdict.
          .orderBy(gateDecisions.createdAt);
        if (Array.isArray(rows) && rows.length > 0) {
          const pick = (g: number) => {
            const last = rows.filter((r) => r.gate === g).pop();
            return last
              ? { score: last.score ?? null, verdict: last.verdict }
              : null;
          };
          gateScores = { g2: pick(2), g4: pick(4), g5: null };
        }
      }
    } catch {
      gateScores = null;
    }

    let messageFeatures: Record<string, unknown> | null = null;
    try {
      messageFeatures = { ...extractMessageFeatures(input.bodyText) };
    } catch {
      messageFeatures = null;
    }

    await database
      .insert(outreachDecisions)
      .values({
        tenantId: input.tenantId,
        contactId: input.contactId ?? null,
        companyId,
        enrollmentId: input.enrollmentId ?? null,
        stepIndex: input.stepIndex ?? null,
        channel: input.channel ?? "email",
        outboundEmailId: input.outboundEmailId ?? null,
        persona,
        signal,
        messageFeatures,
        gateScores,
        model: null, // not knowable at transport (v1)
        angle: null, // T18
        alternatives: null, // T18
        promptVersion: null, // T18
        outcomeId: null, // backfilled by the T8 outcome resolver
        scheduledAt: new Date(),
      })
      // Bare ON CONFLICT DO NOTHING matches the partial unique index on
      // outbound_email_id: an Inngest retry (or the C1/C3 cron race on the
      // same queued row) writes exactly one record, silently.
      .onConflictDoNothing();
    return 1;
  } catch {
    // Best-effort: losing a learning record must never block a send.
    return 0;
  }
}
