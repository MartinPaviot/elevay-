import type { SkillDefinition } from "@/skills/types";
import { icpIdentificationInputSchema, icpIdentificationOutputSchema } from "./schema";
import { icpIdentificationHandler } from "./handler";

export const icpIdentificationSkill: SkillDefinition = {
  slug: "icp-identification",
  name: "ICP Identification",
  category: "scoring",
  description:
    "Analyze a company and define its Ideal Customer Profile: target industries, company sizes, decision-maker roles, technologies, pain points, and exclusions. Uses Apollo enrichment + LLM reasoning.",
  costEstimate: "Free (Apollo org enrich) + ~$0.03 LLM cost",
  inputSchema: icpIdentificationInputSchema,
  outputSchema: icpIdentificationOutputSchema,
  handler: icpIdentificationHandler,
};
