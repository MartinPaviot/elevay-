import { getAuthContext } from "@/lib/auth-utils";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { searchPeople, isApolloAvailable } from "@/lib/apollo-client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.tenantId, authCtx.tenantId)))
    .limit(1);

  if (!company) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Apollo-only — no LLM fallback for contact suggestions
  if (isApolloAvailable() && company.domain) {
    try {
      const result = await searchPeople({
        q_organization_domains: company.domain,
        person_seniorities: ["c_suite", "vp", "director", "manager", "founder", "owner"],
        per_page: 10,
      });

      const suggestions = result.people.map((p) => ({
        name: p.name || [p.first_name, p.last_name].filter(Boolean).join(" "),
        title: p.title || "Unknown",
        email: p.email || null,
        linkedinUrl: p.linkedin_url || null,
        seniority: p.seniority || null,
        departments: p.departments || [],
        city: p.city || null,
        country: p.country || null,
        apolloId: p.id,
        source: "apollo",
        reason: `${p.seniority || "Senior"} ${p.title || "leader"} at ${company.name} — likely involved in purchasing decisions`,
      }));

      return Response.json({ suggestions, source: "apollo" });
    } catch (err) {
      console.warn("Apollo people search failed:", err);
    }
  }

  // No LLM fallback — only return real contacts from Apollo
  return Response.json({
    suggestions: [],
    source: "unavailable",
    message: !isApolloAvailable()
      ? "Apollo API key required for contact suggestions"
      : !company.domain
        ? "No domain available for this account"
        : "Apollo search returned no results",
  });
}
