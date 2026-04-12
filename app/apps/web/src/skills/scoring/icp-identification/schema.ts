import { z } from "zod";

export const icpIdentificationInputSchema = z.object({
  companyDomain: z.string().describe("Company website domain to analyze for ICP definition"),
  existingIcp: z.object({
    industries: z.array(z.string()).optional(),
    sizeRange: z.tuple([z.number(), z.number()]).optional(),
    revenueRange: z.tuple([z.number(), z.number()]).optional(),
    technologies: z.array(z.string()).optional(),
    geographies: z.array(z.string()).optional(),
  }).optional().describe("Existing ICP to refine, if any"),
});

export type IcpIdentificationInput = z.infer<typeof icpIdentificationInputSchema>;

export const icpIdentificationOutputSchema = z.object({
  companyDomain: z.string(),
  companyName: z.string().nullable(),
  icp: z.object({
    industries: z.array(z.string()),
    companySizes: z.array(z.string()),
    revenueRange: z.object({ min: z.number(), max: z.number() }).nullable(),
    geographies: z.array(z.string()),
    targetRoles: z.array(z.string()),
    targetSeniorities: z.array(z.string()),
    technologies: z.array(z.string()),
    painPoints: z.array(z.string()),
    excludeIndustries: z.array(z.string()),
  }),
  reasoning: z.string(),
});

export type IcpIdentificationOutput = z.infer<typeof icpIdentificationOutputSchema>;
