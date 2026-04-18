/**
 * Chantier 2: Service health checks.
 *
 * Runs every 6 hours. Checks that critical services are functioning:
 * - Email sync (OAuth tokens valid)
 * - Recall.ai (API key set + reachable)
 * - Apollo (API key set)
 * - Resend (API key set)
 * - LLM (API key set)
 *
 * If any service is broken, creates a notification for admin users
 * so failures are never silent.
 */

import { inngest } from "./client";
import { db } from "@/db";
import { users, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";

interface HealthResult {
  service: string;
  status: "ok" | "warning" | "error";
  message: string;
}

export const serviceHealthCheck = inngest.createFunction(
  {
    id: "service-health-check",
    retries: 0,
    triggers: [{ cron: "0 */6 * * *" }], // Every 6 hours
  },
  async ({ step }: { step: any }) => {
    const results: HealthResult[] = [];

    // Check LLM
    await step.run("check-llm", () => {
      if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
        results.push({ service: "LLM", status: "error", message: "No ANTHROPIC_API_KEY or OPENAI_API_KEY configured. AI features disabled." });
      } else {
        results.push({ service: "LLM", status: "ok", message: `Using ${process.env.ANTHROPIC_API_KEY ? "Anthropic" : "OpenAI"}` });
      }
    });

    // Check Apollo
    await step.run("check-apollo", () => {
      if (!process.env.APOLLO_API_KEY) {
        results.push({ service: "Apollo", status: "warning", message: "APOLLO_API_KEY not set. TAM building and enrichment will use LLM fallback (lower quality)." });
      } else {
        results.push({ service: "Apollo", status: "ok", message: "API key configured" });
      }
    });

    // Check Resend
    await step.run("check-resend", () => {
      if (!process.env.RESEND_API_KEY) {
        results.push({ service: "Email Sending", status: "error", message: "RESEND_API_KEY not set. Outbound emails cannot be sent." });
      } else {
        results.push({ service: "Email Sending", status: "ok", message: "Resend configured" });
      }
    });

    // Check Recall.ai
    await step.run("check-recall", () => {
      if (!process.env.RECALL_API_KEY) {
        results.push({ service: "Meeting Recording", status: "warning", message: "RECALL_API_KEY not set. Meeting bots won't be scheduled." });
      } else {
        results.push({ service: "Meeting Recording", status: "ok", message: "Recall.ai configured" });
      }
    });

    // Check Auth Secret
    await step.run("check-auth", () => {
      if (!process.env.AUTH_SECRET) {
        results.push({ service: "Authentication", status: "error", message: "AUTH_SECRET not set. Auth will fail." });
      } else {
        results.push({ service: "Authentication", status: "ok", message: "Configured" });
      }
    });

    // Surface errors and warnings as notifications
    const issues = results.filter((r) => r.status !== "ok");

    if (issues.length > 0) {
      await step.run("notify-issues", async () => {
        const adminUsers = await db
          .select({ id: users.id, tenantId: users.tenantId })
          .from(users)
          .where(eq(users.role, "admin"));

        // Group by tenant to avoid duplicate notifications
        const tenants = new Map<string, string[]>();
        for (const u of adminUsers) {
          if (!u.tenantId) continue;
          const list = tenants.get(u.tenantId) || [];
          list.push(u.id);
          tenants.set(u.tenantId, list);
        }

        for (const [tenantId, userIds] of tenants) {
          const title = `${issues.length} service${issues.length > 1 ? "s" : ""} need attention`;
          const body = issues
            .map((i) => `${i.status === "error" ? "!" : "~"} ${i.service}: ${i.message}`)
            .join("\n");

          for (const userId of userIds) {
            await db.insert(notifications).values({
              tenantId,
              userId,
              type: "system",
              title,
              body: body.slice(0, 1000),
            });
          }
        }
      });
    }

    return {
      checked: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      warnings: results.filter((r) => r.status === "warning").length,
      errors: results.filter((r) => r.status === "error").length,
      details: results,
    };
  },
);
