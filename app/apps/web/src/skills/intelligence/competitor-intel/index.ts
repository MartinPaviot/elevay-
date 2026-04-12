import type { SkillDefinition } from "@/skills/types";
import { competitorIntelInputSchema, competitorIntelOutputSchema } from "./schema";
import { competitorIntelHandler } from "./handler";

export const competitorIntelSkill: SkillDefinition = {
  slug: "competitor-intel",
  name: "Competitor Intel",
  category: "intelligence",
  description:
    "Research a competitor: company overview, team/leadership, funding, tech stack, market positioning, competitive strengths, and exploitable vulnerabilities. Combines Apollo enrichment + People Search + LLM analysis.",
  costEstimate: "Free (Apollo) + ~$0.03-0.05 LLM cost",
  inputSchema: competitorIntelInputSchema,
  outputSchema: competitorIntelOutputSchema,
  handler: competitorIntelHandler,
};
