import { db } from "@/db";
import { activities } from "@/db/schema";

export async function logAudit(params: {
  tenantId: string;
  userId: string;
  action: "create" | "update" | "delete";
  entityType: string;
  entityId: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(activities).values({
      tenantId: params.tenantId,
      activityType: "system_event",
      actorType: "user",
      actorId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      channel: "system",
      direction: "internal",
      summary: `User ${params.action}d ${params.entityType}`,
      metadata: {
        audit: true,
        action: params.action,
        changes: params.changes ?? null,
        ...params.metadata,
      },
    });
  } catch (error) {
    // Audit logging should never break the main operation
    console.error("Failed to write audit log:", error);
  }
}
