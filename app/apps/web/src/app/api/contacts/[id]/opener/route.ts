/**
 * GET /api/contacts/[id]/opener
 *
 * Generates a grounded cold-call/email opener for a contact by fusing
 * its company's fired TAM signals + the tenant's product + the contact's
 * seniority methodology (gap D). Deterministic — no LLM dependency — so
 * it always returns something usable for the call-mode brief.
 */

import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { contacts, companies } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenantSettings } from "@/lib/config/tenant-settings";
import {
  generateOpener,
  tamSignalsToAngleSignals,
  type TamSignalBundle,
} from "@/lib/scoring/signal-opener";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, authCtx.tenantId)))
    .limit(1);
  if (!contact) return Response.json({ error: "Contact not found" }, { status: 404 });

  let company: typeof companies.$inferSelect | undefined;
  if (contact.companyId) {
    [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, contact.companyId), eq(companies.tenantId, authCtx.tenantId)))
      .limit(1);
  }

  const settings = await getTenantSettings(authCtx.tenantId);
  const cprops = (company?.properties ?? {}) as Record<string, unknown>;
  const ctprops = (contact.properties ?? {}) as Record<string, unknown>;
  const tam = (cprops.tamSignals ?? null) as TamSignalBundle | null;

  const fundingStage = (cprops.latest_funding_stage as string) ?? null;
  const fundingPrinted = (cprops.total_funding_printed as string) ?? null;
  const fundingDetail =
    fundingStage || fundingPrinted ? [fundingStage, fundingPrinted].filter(Boolean).join(" · ") : null;
  const techs = Array.isArray(cprops.technologies) ? (cprops.technologies as string[]) : [];

  const opener = generateOpener({
    companyName: company?.name ?? "the company",
    contactTitle: contact.title,
    seniority: (ctprops.seniority as string) ?? null,
    signals: tamSignalsToAngleSignals(tam),
    product: settings.productDescription ?? null,
    icpIndustry: company?.industry ?? null,
    fields: {
      fundingDetail,
      technology: techs[0] ?? null,
      geography: (cprops.country as string) ?? null,
    },
  });

  return Response.json({ opener });
}
