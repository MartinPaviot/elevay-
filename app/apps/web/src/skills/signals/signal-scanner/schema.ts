import { z } from "zod";

export const signalScannerInputSchema = z.object({
  companyIds: z.array(z.string()).min(1).max(200).describe("Elevay company IDs to scan for signals"),
  signalTypes: z.array(z.enum([
    "hiring",
    "funding",
    "leadership_change",
    "tech_adoption",
    "expansion",
    "engagement_spike",
    "deal_stall",
    "competitor_mention",
  ])).default(["hiring", "funding", "engagement_spike", "deal_stall"]),
  lookbackDays: z.number().min(1).max(90).default(30),
});

export type SignalScannerInput = z.infer<typeof signalScannerInputSchema>;

const signalSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  signalType: z.string(),
  title: z.string(),
  description: z.string(),
  strength: z.enum(["high", "medium", "low"]),
  detectedAt: z.string(),
  dataSource: z.string(),
});

export const signalScannerOutputSchema = z.object({
  totalCompaniesScanned: z.number(),
  totalSignalsDetected: z.number(),
  signals: z.array(signalSchema),
  companiesWithSignals: z.number(),
});

export type SignalScannerOutput = z.infer<typeof signalScannerOutputSchema>;
