"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, tenants } from "../../lib/db";
import {
  sanitiseQuotaOverrides,
  type QuotaOverrides,
  type LimitKey,
} from "@web/lib/pricing/admin-validation";

export type { QuotaOverrides, LimitKey };

export interface UpdateQuotaOverridesInput {
  tenantId: string;
  overrides: QuotaOverrides;
}

export interface UpdateQuotaOverridesResult {
  ok: boolean;
  error?: string;
}

export async function updateQuotaOverrides(
  input: UpdateQuotaOverridesInput
): Promise<UpdateQuotaOverridesResult> {
  if (!input.tenantId || typeof input.tenantId !== "string") {
    return { ok: false, error: "tenantId is required" };
  }

  const { clean, errors } = sanitiseQuotaOverrides(input.overrides);
  if (errors.length > 0) {
    return { ok: false, error: errors.join("; ") };
  }

  const [row] = await db
    .update(tenants)
    .set({ quotaOverrides: clean })
    .where(eq(tenants.id, input.tenantId))
    .returning({ id: tenants.id });

  if (!row) {
    return { ok: false, error: "tenant not found" };
  }

  // Revalidate the list so the next navigation shows the new values.
  revalidatePath("/tenants");
  return { ok: true };
}
