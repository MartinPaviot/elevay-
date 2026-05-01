import { db } from "@/db";
import { contacts, companies } from "@/db/schema";
import { eq, and, ilike, isNull } from "drizzle-orm";
import { findCompanyDuplicate } from "./dedup";

/**
 * Given contact data with company info, find or create the company
 * and return its ID for linking.
 */
export async function wireContactToCompany(
  tenantId: string,
  companyName?: string | null,
  companyDomain?: string | null,
  importJobId?: string
): Promise<string | null> {
  if (!companyName && !companyDomain) return null;

  // Try to find existing company
  const match = await findCompanyDuplicate(tenantId, companyDomain, companyName);
  if (match) return match.id;

  // Create new company if we have enough data
  if (companyName) {
    let domain = companyDomain;
    if (!domain && companyName) {
      // Attempt naive domain derivation from company name
      const slug = companyName.toLowerCase()
        .replace(/\b(inc|corp|corporation|ltd|llc|gmbh|sas|sarl|sa|ag|co|company)\b\.?/gi, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
      if (slug.length >= 2) {
        domain = `${slug}.com`;
      }
    }

    const [newCompany] = await db
      .insert(companies)
      .values({
        tenantId,
        name: companyName.trim(),
        domain: domain ?? null,
        properties: importJobId ? { importJobId } : undefined,
      })
      .returning();

    return newCompany.id;
  }

  return null;
}

/**
 * Link a contact to a company by updating the contact's companyId.
 */
export async function linkContactToCompany(
  contactId: string,
  companyId: string,
  tenantId: string
): Promise<void> {
  await db
    .update(contacts)
    .set({ companyId, updatedAt: new Date() })
    .where(
      and(
        eq(contacts.id, contactId),
        eq(contacts.tenantId, tenantId)
      )
    );
}

/**
 * Extract domain from email address.
 */
export function extractDomainFromEmail(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1].toLowerCase().trim();
  // Skip generic email providers
  const genericDomains = new Set([
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "aol.com", "icloud.com", "mail.com", "protonmail.com",
    "live.com", "msn.com", "orange.fr", "free.fr", "sfr.fr",
    "laposte.net", "wanadoo.fr",
  ]);
  if (genericDomains.has(domain)) return null;
  return domain;
}
