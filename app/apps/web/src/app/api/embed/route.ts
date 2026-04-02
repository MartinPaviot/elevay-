import { getAuthContext } from "@/lib/auth-utils";
import { db } from "@/db";
import { contacts, companies, activities, deals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { embedEntity, contactToText, companyToText, activityToText, dealToText } from "@/lib/embeddings";

export async function POST(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { scope } = body; // "all", "contacts", "companies", "activities", "deals"

    let embedded = 0;
    const tenantId = authCtx.tenantId;

    // Build company name lookup for enriching contacts and deals
    const allCompanies = await db.select().from(companies).where(eq(companies.tenantId, tenantId));
    const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

    // Build contact name lookup for enriching deals
    const allContacts = await db.select().from(contacts).where(eq(contacts.tenantId, tenantId));
    const contactMap = new Map(allContacts.map((c) => [c.id, c]));

    if (scope === "all" || scope === "contacts") {
      for (const contact of allContacts) {
        const company = contact.companyId ? companyMap.get(contact.companyId) : null;
        const text = contactToText({
          firstName: contact.firstName,
          lastName: contact.lastName,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          properties: contact.properties as Record<string, unknown> | null,
          companyName: company?.name || null,
        });
        if (text.trim()) {
          await embedEntity(tenantId, "contact", contact.id, text);
          embedded++;
        }
      }
    }

    if (scope === "all" || scope === "companies") {
      for (const company of allCompanies) {
        const text = companyToText({
          name: company.name,
          domain: company.domain,
          industry: company.industry,
          revenue: company.revenue,
          size: company.size,
          description: company.description,
        });
        if (text.trim()) {
          await embedEntity(tenantId, "company", company.id, text);
          embedded++;
        }
      }
    }

    if (scope === "all" || scope === "deals") {
      const allDeals = await db.select().from(deals).where(eq(deals.tenantId, tenantId));
      for (const deal of allDeals) {
        const company = deal.companyId ? companyMap.get(deal.companyId) : null;
        const contact = deal.contactId ? contactMap.get(deal.contactId) : null;
        const contactName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : null;
        const text = dealToText({
          name: deal.name,
          stage: deal.stage,
          value: deal.value,
          currency: deal.currency,
          expectedCloseDate: deal.expectedCloseDate,
          summary: deal.summary,
          companyName: company?.name || null,
          contactName,
        });
        if (text.trim()) {
          await embedEntity(tenantId, "deal", deal.id, text);
          embedded++;
        }
      }
    }

    if (scope === "all" || scope === "activities") {
      const allActivities = await db.select().from(activities).where(eq(activities.tenantId, tenantId));
      for (const activity of allActivities) {
        const text = activityToText({
          activityType: activity.activityType,
          summary: activity.summary,
          rawContent: activity.rawContent,
          channel: activity.channel,
          direction: activity.direction,
          occurredAt: activity.occurredAt,
        });
        if (text.trim()) {
          await embedEntity(tenantId, "activity", activity.id, text);
          embedded++;
        }
      }
    }

    return Response.json({ success: true, embedded });
  } catch (error) {
    console.error("Embedding failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: `Embedding failed: ${message}` }, { status: 500 });
  }
}
