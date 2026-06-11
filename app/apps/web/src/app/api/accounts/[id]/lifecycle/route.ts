import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  normalizeLifecycleStage,
  LIFECYCLE_STAGES,
  LIFECYCLE_AUTO,
  EFFECTIVE_LIFECYCLE_STAGE_SQL,
} from "@/lib/accounts/lifecycle-stage";

/**
 * Set (or clear, with stage="auto") the account's manual lifecycle override.
 * The effective stage otherwise follows the account's deals — see
 * lib/accounts/lifecycle-stage.ts.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const stage = typeof body.stage === "string" ? normalizeLifecycleStage(body.stage) : null;

    if (!stage) {
      return Response.json(
        {
          error: "Invalid lifecycle stage",
          validStages: [...LIFECYCLE_STAGES, LIFECYCLE_AUTO],
        },
        { status: 400 }
      );
    }

    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.id, id),
          eq(companies.tenantId, authCtx.tenantId),
          isNull(companies.deletedAt),
        ),
      )
      .limit(1);

    if (!company) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    // Atomic jsonb merge — a read-modify-write spread would clobber concurrent
    // property writes. Also drops the dead 'lifecycle' key an earlier version
    // wrote.
    await db
      .update(companies)
      .set({
        properties:
          stage === LIFECYCLE_AUTO
            ? sql`(COALESCE("companies"."properties", '{}'::jsonb) - 'lifecycle' - 'lifecycleStage')`
            : sql`(COALESCE("companies"."properties", '{}'::jsonb) - 'lifecycle') || ${JSON.stringify({ lifecycleStage: stage })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companies.id, id),
          eq(companies.tenantId, authCtx.tenantId),
          isNull(companies.deletedAt),
        ),
      );

    const [effRow] = await db.execute(
      sql`SELECT ${sql.raw(EFFECTIVE_LIFECYCLE_STAGE_SQL)} AS stage FROM companies WHERE id = ${id} AND tenant_id = ${authCtx.tenantId}`,
    ) as unknown as Array<{ stage: string }>;

    return Response.json({
      success: true,
      override: stage === LIFECYCLE_AUTO ? null : stage,
      effectiveStage: effRow?.stage ?? "new",
    });
  } catch (error) {
    console.error("Failed to update lifecycle stage:", error);
    return Response.json({ error: "Failed to update lifecycle stage" }, { status: 500 });
  }
}
