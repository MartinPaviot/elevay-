/**
 * GET /api/sequences/drafts/[id]/context
 *
 * P0-1 task 1.2 — context bundle for the approval UI's "Why this
 * draft?" panel.
 *
 * Returns the surrounding context the founder needs to decide
 * approve/reject :
 *   - contact (name, title, email)
 *   - account (name, domain, score, industry)
 *   - deal (id, name, stage, value) when a deal links to this contact
 *   - recentInteractions (last 5 emails/meetings/notes)
 *   - signalsAtTriggerTime (verbatim from `personalization_sources`)
 *
 * All reads are tenant-scoped. Returns 404 when the draft is missing
 * (or in another tenant).
 */

import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import {
  sequenceDrafts,
  contacts,
  companies,
  deals,
  activities,
  gateDecisions,
} from "@/db/schema";
import { and, asc, eq, desc, isNull } from "drizzle-orm";

/**
 * T11c — a human, one-line "why" from a gate's reasons jsonb. Each gate
 * stores a different shape (G1: reason code; G2: ungrounded tokens; G4:
 * grader issues; G5: transport failures), so extraction is per-gate. Returns
 * null when there is nothing quotable.
 */
export function gateReasonText(gate: number, reasons: unknown): string | null {
  const r = (reasons ?? {}) as Record<string, unknown>;
  const list = (v: unknown, n = 3): string | null =>
    Array.isArray(v) && v.length > 0 ? v.slice(0, n).map(String).join(", ") : null;
  if (gate === 1) return typeof r.reason === "string" ? r.reason : null;
  if (gate === 2) {
    const ung = list(r.ungrounded);
    return ung ? `Unverifiable: ${ung}` : null;
  }
  if (gate === 4) {
    const issues = list(r.issues);
    return issues ?? (typeof r.threshold === "number" ? `Below quality threshold ${r.threshold}` : null);
  }
  if (gate === 5) {
    const fail = list(r.failures);
    return fail ? `Content: ${fail}` : null;
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [draft] = await db
    .select()
    .from(sequenceDrafts)
    .where(
      and(
        eq(sequenceDrafts.id, id),
        eq(sequenceDrafts.tenantId, authCtx.tenantId),
      ),
    )
    .limit(1);

  if (!draft) {
    return Response.json({ error: "Draft not found" }, { status: 404 });
  }

  // Parallel fetches — contact + (company via contact.companyId) +
  // most-recent open deal for the company + last 5 activities for
  // the contact.
  const [contactRow] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, draft.contactId),
        eq(contacts.tenantId, authCtx.tenantId),
        isNull(contacts.deletedAt),
      ),
    )
    .limit(1);

  let companyRow: typeof companies.$inferSelect | null = null;
  let dealRow: typeof deals.$inferSelect | null = null;

  if (contactRow?.companyId) {
    const [c] = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.id, contactRow.companyId),
          eq(companies.tenantId, authCtx.tenantId),
          isNull(companies.deletedAt),
        ),
      )
      .limit(1);
    companyRow = c ?? null;

    if (companyRow) {
      const [d] = await db
        .select()
        .from(deals)
        .where(
          and(
            eq(deals.tenantId, authCtx.tenantId),
            eq(deals.companyId, companyRow.id),
            isNull(deals.deletedAt),
          ),
        )
        .orderBy(desc(deals.updatedAt))
        .limit(1);
      dealRow = d ?? null;
    }
  }

  const recentActivities = await db
    .select({
      id: activities.id,
      activityType: activities.activityType,
      channel: activities.channel,
      direction: activities.direction,
      occurredAt: activities.occurredAt,
      summary: activities.summary,
      sentiment: activities.sentiment,
    })
    .from(activities)
    .where(
      and(
        eq(activities.tenantId, authCtx.tenantId),
        eq(activities.entityType, "contact"),
        eq(activities.entityId, draft.contactId),
        isNull(activities.deletedAt),
      ),
    )
    .orderBy(desc(activities.occurredAt))
    .limit(5);

  // T11c (M13-R7) — the gate verdicts behind this draft: G4 wrote them at
  // generation (subject_type 'draft', subject_id = draft.id). Ascending by
  // createdAt so the LAST row per gate wins (a reworked draft supersedes its
  // earlier verdict). Reduced to one entry per gate for the review panel.
  const gateRows = await db
    .select({
      gate: gateDecisions.gate,
      score: gateDecisions.score,
      verdict: gateDecisions.verdict,
      reasons: gateDecisions.reasons,
    })
    .from(gateDecisions)
    .where(
      and(
        eq(gateDecisions.tenantId, authCtx.tenantId),
        eq(gateDecisions.subjectType, "draft"),
        eq(gateDecisions.subjectId, draft.id),
      ),
    )
    .orderBy(asc(gateDecisions.createdAt));

  const gateScores: Record<
    string,
    { score: number | null; verdict: string; reason: string | null }
  > = {};
  for (const row of gateRows) {
    gateScores[`g${row.gate}`] = {
      score: row.score ?? null,
      verdict: row.verdict,
      // T11c — the WHY behind a non-pass verdict, extracted per gate from the
      // heterogeneous reasons jsonb (each gate stores a different shape). Null
      // for a pass. Surfaced as the "gate fautif ET la raison" (Done).
      reason: row.verdict === "pass" ? null : gateReasonText(row.gate, row.reasons),
    };
  }

  return Response.json({
    draft: {
      id: draft.id,
      status: draft.status,
      triggerReason: draft.triggerReason,
      generatedAt: draft.generatedAt?.toISOString(),
      // P0-4 — surfaced in the review "Deliverability check" section.
      spamScore: draft.spamScore ?? null,
      spamSeverity: draft.spamSeverity ?? null,
      spamWarnings: draft.spamWarnings ?? [],
      // T11c — the data-backed composite quality score (0-1), if graded.
      qualityScore: draft.qualityScore ?? null,
    },
    // T11c — { g1?, g2?, g4?, g5? } => { score, verdict } for the gates panel.
    gateScores,
    contact: contactRow
      ? {
          id: contactRow.id,
          firstName: contactRow.firstName,
          lastName: contactRow.lastName,
          email: contactRow.email,
          title: contactRow.title,
          score: contactRow.score,
        }
      : null,
    account: companyRow
      ? {
          id: companyRow.id,
          name: companyRow.name,
          domain: companyRow.domain,
          score: companyRow.score,
        }
      : null,
    deal: dealRow
      ? {
          id: dealRow.id,
          name: dealRow.name,
          stage: dealRow.stage,
          value: dealRow.value,
        }
      : null,
    recentInteractions: recentActivities.map((a) => ({
      id: a.id,
      type: a.activityType,
      channel: a.channel,
      direction: a.direction,
      occurredAt: a.occurredAt?.toISOString(),
      summary: a.summary,
      sentiment: a.sentiment,
    })),
    signalsAtTriggerTime: draft.personalizationSources,
  });
}
