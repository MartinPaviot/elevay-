import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { contacts, companies, homeSequenceProposals, sequenceEnrollments, sequenceSteps } from "@/db/schema";
import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { getTemplate } from "@/lib/sequences/templates/registry";
import { instantiateTemplate } from "@/lib/sequences/templates/instantiate";
import { tenantInstantiateDeps } from "@/lib/sequences/templates/db-deps";
import { createAccountListWithMembers } from "@/lib/accounts/account-lists-db";
import { checkContactEligibility } from "@/lib/sequences/enrollment-eligibility";
import { loadG1Context } from "@/lib/sequences/eligibility-context";
import { g1DecisionRow, recordGateDecisions, type GateDecisionInput } from "@/lib/gates/gate-decisions";
import { loadSuppressedEmails } from "@/lib/sequences/suppression";
import { guardEnrollment } from "@/lib/anti-collision/enroll-guard";

/**
 * POST /api/home/proposals/[id]/launch (home-proposed-lane)
 *
 * The founder accepts a "Proposed by Elevay" launch. NOTHING sends here:
 *   1. the proven template is instantiated as a DRAFT sequence (idempotent on
 *      campaignConfig->>'templateId' — the send worker only touches ACTIVE
 *      sequences, so this configures without sending);
 *   2. the cohort becomes an account list (the reviewable artifact);
 *   3. the cohort's contacts run the SAME gate stack as
 *      enrollAccountListInSequence — eligibility (incl. G1 fresh-signal
 *      recheck at launch time, INV-2) + suppression + already-enrolled +
 *      anti-collision — and the eligible ones get enrollment rows.
 * Activation stays a separate human act in /sequences/[id]; every eventual
 * send still traverses evaluateSend (INV-10).
 *
 * Direct-enroll on click is the same trust level as the founder's own
 * bulk-enroll paths; the DRAFT status is the review gate that matters here.
 */

const bodySchema = z.object({ version: z.number().int() });
/** Same bound as the chat list-enroll — one launch never bursts unbounded rows. */
const ENROLL_CANDIDATE_CAP = 500;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "version is required" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(homeSequenceProposals)
    .where(
      and(
        eq(homeSequenceProposals.id, id),
        eq(homeSequenceProposals.tenantId, authCtx.tenantId),
      ),
    )
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  if (row.status !== "pending_review") {
    return NextResponse.json({ error: `Proposal is already ${row.status}` }, { status: 409 });
  }
  if (row.version !== body.version) {
    return NextResponse.json({ error: "Proposal changed — reload and retry" }, { status: 409 });
  }

  const template = getTemplate(row.templateId);
  if (!template) {
    // Defensive: FAMILY_TO_TEMPLATE only maps to catalog ids; a row can only
    // get here if the catalog dropped a template after the row was drafted.
    return NextResponse.json({ error: `Unknown template: ${row.templateId}` }, { status: 409 });
  }

  const cohortIds = Array.isArray(row.companyIds) ? (row.companyIds as string[]) : [];
  if (!cohortIds.length) {
    return NextResponse.json({ error: "Empty cohort" }, { status: 409 });
  }

  try {
    // ── Gate pass FIRST (before creating anything): the cohort may have gone
    // stale between drafting and the click — excluded companies, suppressed
    // emails, expired signals (G1 recheck = INV-2 at launch time).
    const contactRows = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        deletedAt: contacts.deletedAt,
        companyId: contacts.companyId,
        companyExcludedReason: companies.excludedReason,
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id))
      .where(
        and(
          eq(contacts.tenantId, authCtx.tenantId),
          isNull(contacts.deletedAt),
          inArray(contacts.companyId, cohortIds),
          isNotNull(contacts.email),
          sql`${contacts.email} <> ''`,
        ),
      )
      .limit(ENROLL_CANDIDATE_CAP);
    const g1Ctx = await loadG1Context(authCtx.tenantId, contactRows.map((r) => r.companyId));
    const suppressed = await loadSuppressedEmails(
      authCtx.tenantId,
      contactRows.map((r) => r.email).filter((e): e is string => !!e),
    );

    let skipped = 0;
    const eligible: string[] = [];
    const g1Rows: GateDecisionInput[] = [];
    for (const r of contactRows) {
      const elig = checkContactEligibility({
        email: r.email,
        deletedAt: r.deletedAt,
        companyExcludedReason: r.companyExcludedReason,
        suppressedReason: r.email && suppressed.has(r.email.toLowerCase()) ? "hard_bounce" : null,
        g1: g1Ctx.forCompany(r.companyId),
      });
      const g1Row = g1DecisionRow({
        tenantId: authCtx.tenantId,
        contactId: r.id,
        result: elig,
        reasons: { proposalId: row.id, source: "home_proposal_launch" },
      });
      if (g1Row) g1Rows.push(g1Row);
      if (!elig.eligible) {
        skipped++;
        continue;
      }
      eligible.push(r.id);
    }
    await recordGateDecisions(g1Rows);

    if (!eligible.length) {
      // Nothing enrollable left — don't create a sequence/list for nothing;
      // the row stays pending so the founder can still Dismiss it.
      return NextResponse.json(
        { error: "No eligible contacts left in this cohort", skipped },
        { status: 409 },
      );
    }

    // ── Create the artifacts.
    const instantiated = await instantiateTemplate(
      authCtx.tenantId,
      template,
      tenantInstantiateDeps(),
      { status: "draft", createdBy: authCtx.userId },
    );
    const sequenceId = instantiated.sequenceId;

    const now = new Date();
    const baseName = `${row.title} · ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    let listResult = await createAccountListWithMembers(
      authCtx.tenantId,
      baseName,
      authCtx.appUserId,
      cohortIds,
    );
    if (!listResult.ok) {
      // Name already taken (relaunch after dismiss, same day) — suffix and retry once.
      listResult = await createAccountListWithMembers(
        authCtx.tenantId,
        `${baseName} · ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`,
        authCtx.appUserId,
        cohortIds,
      );
    }
    if (!listResult.ok) {
      return NextResponse.json({ error: "Could not create the account list" }, { status: 500 });
    }
    const listId = listResult.list.id;

    // ── Enroll (anti-collision per contact; conflict-safe insert).
    const [firstStep] = await db
      .select({ delayDays: sequenceSteps.delayDays })
      .from(sequenceSteps)
      .where(eq(sequenceSteps.sequenceId, sequenceId))
      .orderBy(sequenceSteps.stepNumber)
      .limit(1);
    const firstDelay = firstStep?.delayDays ?? 0;
    const already = new Set(
      (
        await db
          .select({ contactId: sequenceEnrollments.contactId })
          .from(sequenceEnrollments)
          .where(
            and(
              eq(sequenceEnrollments.sequenceId, sequenceId),
              inArray(sequenceEnrollments.contactId, eligible),
            ),
          )
      ).map((r) => r.contactId),
    );

    let enrolled = 0;
    for (const contactId of eligible) {
      if (already.has(contactId)) {
        skipped++;
        continue;
      }
      const ac = await guardEnrollment({
        tenantId: authCtx.tenantId,
        contactId,
        enrollmentId: `${sequenceId}:${contactId}`,
      });
      if (!ac.proceed) {
        skipped++;
        continue;
      }
      const nextStepAt = new Date(now);
      nextStepAt.setDate(nextStepAt.getDate() + firstDelay);
      await db
        .insert(sequenceEnrollments)
        .values({ sequenceId, contactId, currentStep: 1, nextStepAt })
        .onConflictDoNothing();
      enrolled++;
    }

    // ── Flip the proposal (version-guarded — a concurrent dismiss loses).
    const flipped = await db
      .update(homeSequenceProposals)
      .set({
        status: "launched",
        launchedAt: now,
        reviewedAt: now,
        launchedSequenceId: sequenceId,
        launchedListId: listId,
        version: row.version + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(homeSequenceProposals.id, id),
          eq(homeSequenceProposals.tenantId, authCtx.tenantId),
          eq(homeSequenceProposals.version, row.version),
        ),
      )
      .returning({ id: homeSequenceProposals.id });
    if (!flipped.length) {
      return NextResponse.json({ error: "Proposal changed — reload and retry" }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      sequenceId,
      listId,
      listName: listResult.list.name,
      enrolled,
      skipped,
      sequenceStatus: "draft",
    });
  } catch (err) {
    console.error("home/proposals/launch failed", err);
    return NextResponse.json({ error: "Launch failed" }, { status: 500 });
  }
}
