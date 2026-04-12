import { z } from "zod";

export const competitorIntelInputSchema = z.object({
  competitorDomain: z.string().describe("Competitor website domain"),
  competitorName: z.string().optional(),
  focusAreas: z.array(z.enum([
    "product", "pricing", "positioning", "team", "funding", "tech_stack",
    "content_strategy", "customer_base", "reviews",
  ])).default(["product", "positioning", "team", "funding"]),
});

export type CompetitorIntelInput = z.infer<typeof competitorIntelInputSchema>;

export const competitorIntelOutputSchema = z.object({
  competitorName: z.string(),
  competitorDomain: z.string(),
  intel: z.object({
    companyOverview: z.string(),
    industry: z.string().nullable(),
    employeeCount: z.number().nullable(),
    revenue: z.string().nullable(),
    funding: z.object({
      stage: z.string().nullable(),
      totalFunding: z.string().nullable(),
    }),
    techStack: z.array(z.string()),
    keyPeople: z.array(z.object({
      name: z.string(),
      title: z.string(),
      linkedinUrl: z.string().nullable(),
    })),
    positioning: z.string(),
    strengths: z.array(z.string()),
    vulnerabilities: z.array(z.string()),
  }),
});

export type CompetitorIntelOutput = z.infer<typeof competitorIntelOutputSchema>;
