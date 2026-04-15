import { db } from "@/db";
import {
  activities,
  companies,
  contacts,
  sequences,
  sequenceSteps,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { buildProspectContext } from "@/lib/prospect-context";
import { generateSequence } from "@/lib/sequence-generator";
import { makeTool, type ToolContext } from "./context";

export function buildActionTools(ctx: ToolContext) {
  const { tenantId } = ctx;

  return {
    draftEmail: makeTool({
      description:
        "Draft a personalized email to a contact. Returns the email content for the user to review and send via the email composer. Use when the user asks to 'email', 'draft', 'write to', 'follow up with', or 'reach out to' someone.",
      inputSchema: z.object({
        contactId: z.string().describe("Contact ID to email"),
        purpose: z
          .string()
          .describe("Purpose of the email: follow-up, introduction, revival, meeting-request, custom"),
        customInstructions: z
          .string()
          .optional()
          .describe("Any specific instructions from the user about what to include"),
      }),
      execute: async (input) => {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(and(eq(contacts.id, input.contactId), eq(contacts.tenantId, tenantId)))
          .limit(1);
        if (!contact) return { error: "Contact not found" };

        const recentInteractions = await db
          .select()
          .from(activities)
          .where(
            and(
              eq(activities.tenantId, tenantId),
              eq(activities.entityType, "contact"),
              eq(activities.entityId, input.contactId)
            )
          )
          .orderBy(desc(activities.occurredAt))
          .limit(5);

        const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
        let company = null;
        if (contact.companyId) {
          const [c] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, contact.companyId))
            .limit(1);
          company = c;
        }

        const { getWritingSamples, buildWritingStylePrompt } = await import(
          "@/lib/writing-profile"
        );
        const samples = await getWritingSamples(tenantId);
        const stylePrompt = buildWritingStylePrompt(samples);

        return {
          emailDraft: {
            to: contact.email,
            contactName,
            company: company?.name,
            purpose: input.purpose,
            recentInteractions: recentInteractions.map((a) => ({
              type: a.activityType,
              summary: a.summary,
              date: a.occurredAt,
            })),
          },
          instruction: `Use this context to generate a personalized email. Include specifics from recent interactions. Keep it concise and actionable.${
            stylePrompt ? `\n\n${stylePrompt}` : ""
          }\n\nReturn the draft in your response.`,
        };
      },
    }),

    proposeCampaign: makeTool({
      description: `Propose an outbound email campaign targeting specific accounts. Use when user asks to "launch a campaign", "reach out to", "start outreach", or "email my top accounts". Creates a draft sequence and returns a proposal for user approval.`,
      inputSchema: z.object({
        targetDescription: z
          .string()
          .describe(
            "Description of who to target, e.g. 'fintech companies with score B or above'"
          ),
        campaignGoal: z.string().describe("What the campaign aims to achieve, e.g. 'book demo meetings'"),
        stepCount: z.number().optional().describe("Number of email steps (default 3)"),
      }),
      execute: async (input) => {
        const steps = input.stepCount || 3;

        const allAccounts = await db
          .select({
            id: companies.id,
            name: companies.name,
            domain: companies.domain,
            industry: companies.industry,
            score: companies.score,
          })
          .from(companies)
          .where(eq(companies.tenantId, tenantId))
          .orderBy(desc(companies.score))
          .limit(100);

        const targetDesc = input.targetDescription.toLowerCase();
        let matched = allAccounts;

        const industryKeywords = allAccounts
          .map((a) => a.industry)
          .filter(Boolean)
          .map((i) => i!.toLowerCase());
        const industryMatch = industryKeywords.find((i) => targetDesc.includes(i));
        if (industryMatch) {
          matched = matched.filter((a) => a.industry?.toLowerCase() === industryMatch);
        }

        if (targetDesc.includes("score a") || targetDesc.includes("grade a")) {
          matched = matched.filter((a) => (a.score || 0) >= 80);
        } else if (
          targetDesc.includes("score b") ||
          targetDesc.includes("grade b") ||
          targetDesc.includes("b or above") ||
          targetDesc.includes("b+")
        ) {
          matched = matched.filter((a) => (a.score || 0) >= 60);
        }

        matched = matched.slice(0, 20);

        if (matched.length === 0) {
          return {
            type: "campaign_proposal",
            status: "no_matches",
            message: `No accounts match "${input.targetDescription}". Try broadening your criteria or check your TAM.`,
            targetCount: 0,
          };
        }

        const [seq] = await db
          .insert(sequences)
          .values({
            tenantId,
            name: `Campaign: ${input.campaignGoal}`,
            description: `Auto-generated campaign targeting: ${input.targetDescription}`,
            status: "draft",
          })
          .returning();

        let generatedSteps = false;
        const topCompany = matched[0];
        if (topCompany) {
          const [bestContact] = await db
            .select({ id: contacts.id })
            .from(contacts)
            .where(and(eq(contacts.companyId, topCompany.id), eq(contacts.tenantId, tenantId)))
            .orderBy(desc(contacts.score))
            .limit(1);

          if (bestContact) {
            try {
              const prospectCtx = await buildProspectContext(bestContact.id, tenantId);
              if (prospectCtx) {
                const generated = await generateSequence(prospectCtx, {
                  stepCount: steps,
                  tenantId,
                });
                for (const step of generated.steps) {
                  await db.insert(sequenceSteps).values({
                    sequenceId: seq.id,
                    stepNumber: step.stepNumber,
                    delayDays: step.delayDays,
                    subjectTemplate: step.subject,
                    bodyTemplate: step.body,
                  });
                }
                generatedSteps = true;
              }
            } catch (err) {
              console.warn("Failed to generate AI steps, using placeholders:", err);
            }
          }
        }

        if (!generatedSteps) {
          for (let i = 1; i <= steps; i++) {
            const delay = i === 1 ? 0 : i === 2 ? 3 : 5;
            await db.insert(sequenceSteps).values({
              sequenceId: seq.id,
              stepNumber: i,
              delayDays: delay,
              subjectTemplate: `Step ${i} — ${input.campaignGoal}`,
              bodyTemplate: `[Visit /sequences/${seq.id} to generate personalized content]`,
            });
          }
        }

        return {
          type: "campaign_proposal",
          status: "proposed",
          sequenceId: seq.id,
          sequenceName: seq.name,
          targetCount: matched.length,
          targets: matched.slice(0, 5).map((a) => ({
            name: a.name,
            industry: a.industry,
            score: a.score,
          })),
          stepCount: steps,
          goal: input.campaignGoal,
          message: `Campaign proposed: ${matched.length} accounts, ${steps} email steps. The user can review and launch from the Campaigns page at /sequences/${seq.id}.`,
          isProposal: true,
          proposalAction: "campaign",
        };
      },
    }),
  };
}
