import type { SkillDefinition } from "@/skills/types";
import { churnRiskDetectorInputSchema, churnRiskDetectorOutputSchema } from "./schema";
import { churnRiskDetectorHandler } from "./handler";

export const churnRiskDetectorSkill: SkillDefinition = {
  slug: "churn-risk-detector",
  name: "Churn Risk Detector",
  category: "intelligence",
  description:
    "Scan all accounts for churn risk signals: inactivity, negative sentiment, engagement drops. Prioritizes by severity (critical/high/medium) and suggests actions for each at-risk account.",
  costEstimate: "Free (DB queries only)",
  inputSchema: churnRiskDetectorInputSchema,
  outputSchema: churnRiskDetectorOutputSchema,
  handler: churnRiskDetectorHandler,
};
