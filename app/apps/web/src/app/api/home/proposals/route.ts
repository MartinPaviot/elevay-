import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { homeSequenceProposals } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { cadenceSummaryFor } from "@/lib/home/sequence-proposals";

/**
 * GET /api/home/proposals (home-proposed-lane)
 *
 * Lists the tenant's pending "Proposed by Elevay" launch proposals, biggest
 * reach first. Tenant-scoped (proposals are workspace-level — signals belong
 * to the tenant's companies, not a mailbox owner). Read-only; the founder
 * acts via the launch/dismiss routes. Fail-soft: an empty list is a normal
 * state, never a hard failure surfaced to the dashboard card (mold:
 * inbox/followups/ready).
 */
export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        id: homeSequenceProposals.id,
        signalFamily: homeSequenceProposals.signalFamily,
        templateId: homeSequenceProposals.templateId,
        title: homeSequenceProposals.title,
        companyNames: homeSequenceProposals.companyNames,
        companyCount: homeSequenceProposals.companyCount,
        contactableCount: homeSequenceProposals.contactableCount,
        freshestAt: homeSequenceProposals.freshestAt,
        generatedAt: homeSequenceProposals.generatedAt,
        version: homeSequenceProposals.version,
      })
      .from(homeSequenceProposals)
      .where(
        and(
          eq(homeSequenceProposals.tenantId, authCtx.tenantId),
          eq(homeSequenceProposals.status, "pending_review"),
        ),
      )
      .orderBy(
        desc(homeSequenceProposals.contactableCount),
        desc(homeSequenceProposals.companyCount),
      );
    return NextResponse.json({
      proposals: rows.map((r) => ({ ...r, cadence: cadenceSummaryFor(r.templateId) })),
    });
  } catch (err) {
    console.error("home/proposals failed", err);
    return NextResponse.json({ proposals: [] });
  }
}
