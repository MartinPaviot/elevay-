/**
 * Render a realistic filled-proposal sample PDF (PROPOSAL-006 regenerate path) so
 * it can be opened in a real PDF viewer. Run:
 *   pnpm -C app/apps/web exec tsx scripts/sample-proposal-pdf.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderProposalPdf } from "../src/lib/proposals/pdf";

const pdf = renderProposalPdf([
  {
    label: "Executive Summary",
    kind: "section",
    content:
      "Acme Corp is scaling its field sales team and is losing context to manual CRM entry. This proposal outlines how Elevay removes that overhead.\nBased on our call on 28 May, the priority is faster proposal turnaround and clean pipeline data.",
  },
  {
    label: "Proposed Solution",
    kind: "section",
    content:
      "Elevay captures every interaction automatically and drafts outbound, briefs and proposals from a live information base, with no manual data entry.",
  },
  { label: "Pricing", kind: "field", content: "Platform: 999 EUR / month per seat. One-time onboarding: 12,000 EUR." },
  {
    label: "Next Steps",
    kind: "section",
    content: "Confirm scope with Sarah Chen (VP Engineering).\nKick off onboarding the week of 16 June.",
  },
]);

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "..", "..", "_artifacts");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, "proposal-sample.pdf");
writeFileSync(out, pdf);

const s = pdf.toString("latin1");
console.log(`Wrote ${out} (${pdf.length} bytes)`);
console.log(`  valid header: ${s.startsWith("%PDF-1.4")}`);
console.log(`  ends with %%EOF: ${s.trimEnd().endsWith("%%EOF")}`);
console.log(`  pages: ${(s.match(/\/Type \/Page\b/g) || []).length}`);
