import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { homeSequenceProposals } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * POST /api/home/proposals/[id]/dismiss (home-proposed-lane)
 *
 * The founder doesn't want this launch — terminal, not a snooze. The dedupe
 * index is content-based (tenant, family, cohortHash), so the same family
 * only re-proposes when its cohort actually changes (a new company with a
 * fresh signal → new hash → new row); this never resurrects a dismissed row.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const [row] = await db
    .select({
      id: homeSequenceProposals.id,
      status: homeSequenceProposals.status,
      version: homeSequenceProposals.version,
    })
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

  const now = new Date();
  await db
    .update(homeSequenceProposals)
    .set({ status: "dismissed", dismissedAt: now, reviewedAt: now, version: row.version + 1, updatedAt: now })
    .where(
      and(
        eq(homeSequenceProposals.id, id),
        eq(homeSequenceProposals.tenantId, authCtx.tenantId),
        eq(homeSequenceProposals.version, row.version),
      ),
    );

  return NextResponse.json({ ok: true });
}
