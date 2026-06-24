/**
 * Spec 33 — DB-backed lawful-basis gate for the live pre-send path.
 *
 * BLOCK-BY-DEFAULT BY DESIGN: assertLawfulBasis blocks any contact without a
 * recorded basis, a clean source, and a jurisdiction-valid basis (gate.ts +
 * policy.ts). Today no contact is backfilled, so enforcing it would halt EVERY
 * send. It therefore stays behind the `LAWFUL_BASIS_GATE` env flag (off by
 * default): when off this is a pure no-op (it does not even query); when the
 * founder has backfilled lawful_basis / jurisdiction / source and flips the flag
 * on, every send path that calls evaluateSend enforces it.
 */

import { db as defaultDb } from "@/db";
import { contacts } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  assertLawfulBasis,
  type ComplianceContact,
  type LawfulBasis,
  type LawfulBasisResult,
} from "./gate";
import type { Jurisdiction } from "./policy";

/** The env flag that turns on enforcement. Default OFF — see the block-by-default note. */
export function isLawfulBasisGateEnabled(): boolean {
  const v = process.env.LAWFUL_BASIS_GATE;
  return v === "1" || v === "true";
}

/** Load a contact's compliance fields (basis/source/jurisdiction) for a tenant+address, or null. Injectable. */
export async function loadComplianceContact(
  tenantId: string,
  email: string,
  database: typeof defaultDb = defaultDb,
): Promise<ComplianceContact | null> {
  const e = email.trim().toLowerCase();
  const rows = await database
    .select({
      id: contacts.id,
      lawfulBasis: contacts.lawfulBasis,
      source: contacts.sourceSystem,
      jurisdiction: contacts.jurisdiction,
    })
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), sql`lower(${contacts.email}) = ${e}`))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    lawfulBasis: (r.lawfulBasis as LawfulBasis | null) ?? null,
    source: (r.source as string | null) ?? null,
    jurisdiction: (r.jurisdiction as Jurisdiction | null) ?? null,
  };
}

/**
 * Resolve the lawful-basis verdict for a send. No-op (allow) when the flag is
 * off. When on, an unknown recipient (no contact row) has no recorded basis and
 * so is blocked — the correct strict behavior once enforcement is enabled.
 */
export async function evaluateLawfulBasisForSend(
  tenantId: string,
  email: string,
  database: typeof defaultDb = defaultDb,
): Promise<LawfulBasisResult> {
  if (!isLawfulBasisGateEnabled()) {
    return { allowed: true, audit: { contactId: "gate-disabled", source: null, sourcePolicy: "clean", jurisdiction: null } };
  }
  const cc =
    (await loadComplianceContact(tenantId, email, database)) ??
    ({ id: `unknown:${email.trim().toLowerCase()}`, lawfulBasis: null, source: null, jurisdiction: null } satisfies ComplianceContact);
  return assertLawfulBasis(cc);
}
