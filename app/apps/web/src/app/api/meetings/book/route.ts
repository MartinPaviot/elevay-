import { getAuthContext } from "@/lib/auth-utils";
import { db } from "@/db";
import { contacts, activities } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createCalendarEvent } from "@/lib/meeting-booking";

export async function POST(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { contactId, startTime, durationMinutes, title } = body;

    if (!contactId || !startTime) {
      return Response.json({ error: "contactId and startTime required" }, { status: 400 });
    }

    // Fetch contact
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, authCtx.tenantId)))
      .limit(1);

    if (!contact || !contact.email) {
      return Response.json({ error: "Contact not found or has no email" }, { status: 404 });
    }

    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Prospect";

    // Create calendar event
    const event = await createCalendarEvent(authCtx.userId, {
      contactEmail: contact.email,
      contactName,
      startTime: new Date(startTime),
      durationMinutes: durationMinutes || 30,
      title: title || `Meeting with ${contactName}`,
    });

    if (!event) {
      return Response.json({ error: "Failed to create calendar event — is Google Calendar connected?" }, { status: 500 });
    }

    // Log activity
    await db.insert(activities).values({
      tenantId: authCtx.tenantId,
      actorType: "user",
      actorId: authCtx.appUserId,
      entityType: "contact",
      entityId: contactId,
      activityType: "meeting_booked",
      channel: "calendar",
      direction: "outbound",
      summary: `Meeting booked: ${title || `Meeting with ${contactName}`}`,
      metadata: {
        eventId: event.eventId,
        meetLink: event.meetLink,
        startTime,
        durationMinutes: durationMinutes || 30,
      },
    });

    return Response.json({
      booked: true,
      eventId: event.eventId,
      meetLink: event.meetLink,
      calendarLink: event.htmlLink,
    });
  } catch (error: any) {
    console.error("Meeting booking failed:", error);
    return Response.json({ error: error.message || "Meeting booking failed" }, { status: 500 });
  }
}
