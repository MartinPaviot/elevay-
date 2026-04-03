import { inngest } from "./client";
import { db } from "@/db";
import { tenants, tasks, activities, outboundEmails, contacts, companies } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendNotification } from "@/lib/notifications";
import type { WorkflowDef } from "@/app/api/settings/workflows/route";

/**
 * Minimum viable workflow engine.
 *
 * Listens for CRM events, checks if any user-defined workflows match,
 * and executes the configured actions.
 *
 * Triggers: deal_stage_changed, contact_created, email_received, task_due
 * Actions: send_notification, create_task, call_webhook, update_field
 */
export const executeWorkflow = inngest.createFunction(
  {
    id: "execute-workflow",
    name: "Execute User Workflow",
    retries: 2,
    triggers: [{ event: "workflow/trigger" }],
  },
  async ({ event, step }) => {
    const { tenantId, triggerType, triggerData, userId } = event.data as {
      tenantId: string;
      triggerType: string;
      triggerData: Record<string, unknown>;
      userId: string;
    };

    // Load workflow definitions
    const workflows = await step.run("load-workflows", async () => {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      const settings = (tenant?.settings || {}) as Record<string, unknown>;
      return ((settings.workflows || []) as WorkflowDef[])
        .filter((w) => w.enabled && w.trigger.type === triggerType);
    });

    if (workflows.length === 0) return { executed: 0 };

    let executed = 0;

    for (const workflow of workflows) {
      // Check conditions
      const conditions = workflow.trigger.conditions || {};
      let matches = true;
      for (const [key, value] of Object.entries(conditions)) {
        if (triggerData[key] !== value) {
          matches = false;
          break;
        }
      }

      if (!matches) continue;

      // Execute actions
      for (const action of workflow.actions) {
        await step.run(`action-${workflow.id}-${action.type}`, async () => {
          switch (action.type) {
            case "send_notification":
              await sendNotification({
                tenantId,
                userId,
                type: "system",
                title: action.params.title || `Workflow: ${workflow.name}`,
                body: action.params.body || `Triggered by ${triggerType}`,
                entityType: triggerData.entityType as string,
                entityId: triggerData.entityId as string,
              });
              break;

            case "create_task":
              await db.insert(tasks).values({
                tenantId,
                assigneeId: userId,
                title: action.params.title || `Auto-task from ${workflow.name}`,
                description: action.params.description,
                dueDate: action.params.dueDays
                  ? new Date(Date.now() + parseInt(action.params.dueDays) * 86400000)
                  : undefined,
                priority: (action.params.priority as "low" | "medium" | "high") || "medium",
                entityType: triggerData.entityType as string,
                entityId: triggerData.entityId as string,
                status: "pending",
              });
              break;

            case "call_webhook":
              if (action.params.url) {
                await fetch(action.params.url, {
                  method: action.params.method || "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    workflow: workflow.name,
                    trigger: triggerType,
                    data: triggerData,
                    timestamp: new Date().toISOString(),
                  }),
                }).catch(console.warn);
              }
              break;

            case "send_email": {
              // Queue an outbound email and trigger immediate send
              const contactId = (triggerData.contactId || action.params.contactId) as string | undefined;
              const toAddress = (triggerData.contactEmail || action.params.toAddress) as string | undefined;

              // Resolve recipient email
              let recipientEmail = toAddress;
              if (!recipientEmail && contactId) {
                const [c] = await db.select({ email: contacts.email }).from(contacts)
                  .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId))).limit(1);
                recipientEmail = c?.email || undefined;
              }

              if (recipientEmail) {
                const [email] = await db.insert(outboundEmails).values({
                  tenantId,
                  contactId: contactId || null,
                  fromAddress: "pending@rotation",
                  toAddress: recipientEmail,
                  subject: action.params.subject || `From workflow: ${workflow.name}`,
                  bodyHtml: `<div>${(action.params.body || "").replace(/\n/g, "<br>")}</div>`,
                  bodyText: action.params.body || "",
                  status: "queued",
                  queuedAt: new Date(),
                }).returning();

                // Fire event for immediate send
                await inngest.send({
                  name: "email/send-now",
                  data: { emailId: email.id },
                });
              }
              break;
            }

            case "update_field": {
              // Update a field on the triggered entity
              const entityType = (triggerData.entityType || action.params.entityType) as string;
              const entityId = (triggerData.entityId || action.params.entityId) as string;
              const fieldName = action.params.fieldName as string;
              const fieldValue = action.params.fieldValue;

              if (entityType && entityId && fieldName) {
                if (entityType === "company") {
                  await db.update(companies).set({ [fieldName]: fieldValue, updatedAt: new Date() })
                    .where(and(eq(companies.id, entityId), eq(companies.tenantId, tenantId)));
                } else if (entityType === "contact") {
                  await db.update(contacts).set({ [fieldName]: fieldValue, updatedAt: new Date() })
                    .where(and(eq(contacts.id, entityId), eq(contacts.tenantId, tenantId)));
                }
              }
              break;
            }

            case "ai_action":
              // AI actions are handled by the chat system — log as activity for now
              await db.insert(activities).values({
                tenantId,
                actorType: "system",
                actorId: null,
                entityType: (triggerData.entityType as string) || "system",
                entityId: (triggerData.entityId as string) || tenantId,
                activityType: "system_event",
                summary: `AI action from workflow "${workflow.name}": ${action.params.instruction || "no instruction"}`,
              });
              break;
          }
        });
      }

      // Update run count
      await step.run(`update-count-${workflow.id}`, async () => {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
        if (tenant) {
          const settings = (tenant.settings || {}) as Record<string, unknown>;
          const allWorkflows = (settings.workflows || []) as WorkflowDef[];
          const updated = allWorkflows.map((w) =>
            w.id === workflow.id
              ? { ...w, runCount: (w.runCount || 0) + 1, lastRunAt: new Date().toISOString() }
              : w
          );
          await db.update(tenants).set({
            settings: { ...settings, workflows: updated },
          }).where(eq(tenants.id, tenantId));
        }
      });

      executed++;
    }

    return { executed, total: workflows.length };
  }
);

/**
 * Helper: fire a workflow trigger from anywhere in the codebase.
 * Call this after CRM events (stage change, contact creation, etc.)
 */
export async function fireWorkflowTrigger(
  tenantId: string,
  userId: string,
  triggerType: string,
  triggerData: Record<string, unknown>
): Promise<void> {
  await inngest.send({
    name: "workflow/trigger",
    data: { tenantId, userId, triggerType, triggerData },
  }).catch(console.warn);
}
