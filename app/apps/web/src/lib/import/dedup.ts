import { db } from "@/db";
import { contacts, companies, deals } from "@/db/schema";
import { eq, and, ilike, isNull, sql } from "drizzle-orm";

export interface DedupMatch {
  id: string;
  name: string;
  confidence: number;
  matchType: "exact_email" | "exact_domain" | "fuzzy_name";
}

export async function findContactDuplicate(
  tenantId: string,
  email?: string | null,
  firstName?: string | null,
  lastName?: string | null,
  companyDomain?: string | null
): Promise<DedupMatch | null> {
  // 1. Exact email match (highest confidence)
  if (email) {
    const [match] = await db
      .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          eq(contacts.email, email.toLowerCase().trim()),
          isNull(contacts.deletedAt)
        )
      )
      .limit(1);

    if (match) {
      return {
        id: match.id,
        name: [match.firstName, match.lastName].filter(Boolean).join(" "),
        confidence: 1.0,
        matchType: "exact_email",
      };
    }
  }

  // 2. First + last name fuzzy match (lower confidence)
  if (firstName && lastName) {
    const [match] = await db
      .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          ilike(contacts.firstName, firstName.trim()),
          ilike(contacts.lastName, lastName.trim()),
          isNull(contacts.deletedAt)
        )
      )
      .limit(1);

    if (match) {
      return {
        id: match.id,
        name: [match.firstName, match.lastName].filter(Boolean).join(" "),
        confidence: 0.75,
        matchType: "fuzzy_name",
      };
    }
  }

  return null;
}

export async function findCompanyDuplicate(
  tenantId: string,
  domain?: string | null,
  name?: string | null
): Promise<DedupMatch | null> {
  // 1. Exact domain match
  if (domain) {
    const normalized = domain.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/.*$/, "");
    const [match] = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(
        and(
          eq(companies.tenantId, tenantId),
          eq(companies.domain, normalized),
          isNull(companies.deletedAt)
        )
      )
      .limit(1);

    if (match) {
      return {
        id: match.id,
        name: match.name,
        confidence: 1.0,
        matchType: "exact_domain",
      };
    }
  }

  // 2. Fuzzy name match (normalized comparison)
  if (name) {
    const normalizedName = name.trim().toLowerCase()
      .replace(/\b(inc|corp|corporation|ltd|llc|gmbh|sas|sarl|sa|ag|co|company)\b\.?/gi, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

    if (normalizedName.length < 2) return null;

    const candidates = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(
        and(
          eq(companies.tenantId, tenantId),
          isNull(companies.deletedAt),
          ilike(companies.name, `%${normalizedName.split(" ")[0]}%`)
        )
      )
      .limit(10);

    for (const c of candidates) {
      const candidateNorm = c.name.toLowerCase()
        .replace(/\b(inc|corp|corporation|ltd|llc|gmbh|sas|sarl|sa|ag|co|company)\b\.?/gi, "")
        .replace(/[^a-z0-9\s]/g, "")
        .trim();

      if (candidateNorm === normalizedName) {
        return {
          id: c.id,
          name: c.name,
          confidence: 0.9,
          matchType: "fuzzy_name",
        };
      }

      // Levenshtein-like: if one is contained in the other
      if (
        candidateNorm.includes(normalizedName) ||
        normalizedName.includes(candidateNorm)
      ) {
        return {
          id: c.id,
          name: c.name,
          confidence: 0.7,
          matchType: "fuzzy_name",
        };
      }
    }
  }

  return null;
}

export async function findDealDuplicate(
  tenantId: string,
  name?: string | null,
  companyId?: string | null
): Promise<DedupMatch | null> {
  if (!name) return null;

  const conditions = [
    eq(deals.tenantId, tenantId),
    ilike(deals.name, name.trim()),
    isNull(deals.deletedAt),
  ];

  if (companyId) {
    conditions.push(eq(deals.companyId, companyId));
  }

  const [match] = await db
    .select({ id: deals.id, name: deals.name })
    .from(deals)
    .where(and(...conditions))
    .limit(1);

  if (match) {
    return {
      id: match.id,
      name: match.name,
      confidence: 0.85,
      matchType: "fuzzy_name",
    };
  }

  return null;
}
