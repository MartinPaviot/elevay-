import type { SkillDefinition } from "@/skills/types";
import { inboundLeadQualificationInputSchema, inboundLeadQualificationOutputSchema } from "./schema";
import { inboundLeadQualificationHandler } from "./handler";

export const inboundLeadQualificationSkill: SkillDefinition = {
  slug: "inbound-lead-qualification",
  name: "Inbound Lead Qualification",
  category: "scoring",
  description:
    "Qualify an inbound lead: score against ICP, detect duplicates, determine priority (hot/warm/nurture/disqualified), and recommend next action. Source-aware: demo requests get priority boost.",
  costEstimate: "Free (DB queries only)",
  inputSchema: inboundLeadQualificationInputSchema,
  outputSchema: inboundLeadQualificationOutputSchema,
  handler: inboundLeadQualificationHandler,
};
