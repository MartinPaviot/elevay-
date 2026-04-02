import { auth } from "@/auth";
import { db } from "@/db";
import {
  users,
  contacts,
  companies,
  deals,
  activities,
  notes,
  tasks,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, session.user.id!));
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const tenantId = user.tenantId;

    const [
      contactsData,
      companiesData,
      dealsData,
      activitiesData,
      notesData,
      tasksData,
    ] = await Promise.all([
      db.select().from(contacts).where(eq(contacts.tenantId, tenantId)),
      db.select().from(companies).where(eq(companies.tenantId, tenantId)),
      db.select().from(deals).where(eq(deals.tenantId, tenantId)),
      db.select().from(activities).where(eq(activities.tenantId, tenantId)),
      db.select().from(notes).where(eq(notes.tenantId, tenantId)),
      db.select().from(tasks).where(eq(tasks.tenantId, tenantId)),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
      },
      data: {
        contacts: contactsData,
        companies: companiesData,
        deals: dealsData,
        activities: activitiesData,
        notes: notesData,
        tasks: tasksData,
      },
      metadata: {
        counts: {
          contacts: contactsData.length,
          companies: companiesData.length,
          deals: dealsData.length,
          activities: activitiesData.length,
          notes: notesData.length,
          tasks: tasksData.length,
        },
      },
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="leadsens-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("GDPR export failed:", error);
    return Response.json({ error: "Export failed" }, { status: 500 });
  }
}
