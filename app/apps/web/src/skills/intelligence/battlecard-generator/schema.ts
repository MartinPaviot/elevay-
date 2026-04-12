import { z } from "zod";

export const battlecardGeneratorInputSchema = z.object({
  competitorDomain: z.string().describe("Competitor website domain"),
  competitorName: z.string().optional(),
  ourProductDescription: z.string().optional().describe("Brief description of our product for comparison"),
});

export type BattlecardGeneratorInput = z.infer<typeof battlecardGeneratorInputSchema>;

export const battlecardGeneratorOutputSchema = z.object({
  competitorName: z.string(),
  competitorDomain: z.string(),
  battlecard: z.object({
    overview: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    pricing: z.string(),
    targetMarket: z.string(),
    positioningTraps: z.array(z.object({
      trap: z.string(),
      howToUse: z.string(),
    })),
    objectionHandlers: z.array(z.object({
      objection: z.string(),
      response: z.string(),
    })),
    landmineQuestions: z.array(z.string()),
    winThemes: z.array(z.string()),
    loseThemes: z.array(z.string()),
    differentiators: z.array(z.string()),
  }),
});

export type BattlecardGeneratorOutput = z.infer<typeof battlecardGeneratorOutputSchema>;
