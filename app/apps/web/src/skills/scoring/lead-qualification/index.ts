import type { SkillDefinition } from "@/skills/types";
import { leadQualificationInputSchema, leadQualificationOutputSchema } from "./schema";
import { leadQualificationHandler } from "./handler";

export const leadQualificationSkill: SkillDefinition = {
  slug: "lead-qualification",
  name: "Lead Qualification",
  category: "scoring",
  description:
    "Batch-qualify contacts against ICP using seniority, engagement, sentiment, and ICP fit scoring. Returns scored and graded leads with qualification status.",
  costEstimate: "Free (DB queries only)",
  inputSchema: leadQualificationInputSchema,
  outputSchema: leadQualificationOutputSchema,
  handler: leadQualificationHandler,
};
