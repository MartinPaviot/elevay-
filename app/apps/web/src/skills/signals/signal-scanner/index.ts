import type { SkillDefinition } from "@/skills/types";
import { signalScannerInputSchema, signalScannerOutputSchema } from "./schema";
import { signalScannerHandler } from "./handler";

export const signalScannerSkill: SkillDefinition = {
  slug: "signal-scanner",
  name: "Signal Scanner",
  category: "signals",
  description:
    "Scan companies for buying signals: funding events, engagement spikes, deal stalls, tech adoption, hiring, leadership changes. Uses diff-based detection on activity history and enrichment data.",
  costEstimate: "Free (DB queries only)",
  inputSchema: signalScannerInputSchema,
  outputSchema: signalScannerOutputSchema,
  handler: signalScannerHandler,
};
