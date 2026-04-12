import type { SkillDefinition } from "@/skills/types";
import { battlecardGeneratorInputSchema, battlecardGeneratorOutputSchema } from "./schema";
import { battlecardGeneratorHandler } from "./handler";

export const battlecardGeneratorSkill: SkillDefinition = {
  slug: "battlecard-generator",
  name: "Battlecard Generator",
  category: "intelligence",
  description:
    "Generate a competitive sales battlecard: strengths, weaknesses, positioning traps, objection handlers, landmine questions, win/lose themes, and differentiators. Uses Apollo enrichment + LLM analysis.",
  costEstimate: "Free (Apollo) + ~$0.05-0.10 LLM cost",
  inputSchema: battlecardGeneratorInputSchema,
  outputSchema: battlecardGeneratorOutputSchema,
  handler: battlecardGeneratorHandler,
};
