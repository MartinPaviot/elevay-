import { z } from "zod";

export const churnRiskDetectorInputSchema = z.object({
  lookbackDays: z.number().min(14).max(180).default(60),
  inactivityThresholdDays: z.number().min(7).max(90).default(21),
});

export type ChurnRiskDetectorInput = z.infer<typeof churnRiskDetectorInputSchema>;

const atRiskAccountSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  riskLevel: z.enum(["critical", "high", "medium"]),
  daysSinceLastActivity: z.number(),
  totalActivitiesInPeriod: z.number(),
  activeDealCount: z.number(),
  totalDealValue: z.number(),
  negativeSentimentCount: z.number(),
  riskReasons: z.array(z.string()),
  suggestedAction: z.string(),
});

export const churnRiskDetectorOutputSchema = z.object({
  period: z.string(),
  totalAccountsAnalyzed: z.number(),
  atRiskAccounts: z.array(atRiskAccountSchema),
  summary: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    totalAtRiskValue: z.number(),
  }),
});

export type ChurnRiskDetectorOutput = z.infer<typeof churnRiskDetectorOutputSchema>;
