/**
 * PROPOSAL-007: live detection scorecard. Measures the LLM core that the unit
 * tests only mock — does detection segment a real proposal correctly?
 *
 * Run (needs an LLM key; loads .env.local for the key + DATABASE_URL):
 *   pnpm -C app/apps/web exec tsx --env-file=.env.local scripts/eval-proposals.ts
 *   ... --file path/to/real-proposal.docx --tenant <tenantId> --expect "Executive Summary,Pricing,Scope"
 *
 * With no --file it runs a synthetic template (known headings) so you can sanity-
 * check the model + plumbing with just a key. Key-gated: exits cleanly without one.
 */

import { readFileSync } from "node:fs";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.log("No ANTHROPIC_API_KEY / OPENAI_API_KEY — skipping live detection eval.");
    console.log("Run: pnpm -C app/apps/web exec tsx --env-file=.env.local scripts/eval-proposals.ts");
    return;
  }

  const { writeZip, extractDocxText } = await import("../src/lib/proposals/ooxml");
  const { detectComponents } = await import("../src/lib/proposals/detect-components");
  const { gradeDetectionCoverage, gradePlaceholders } = await import("../src/lib/proposals/eval/graders");

  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  function sampleDocx(headings: string[]): Buffer {
    const body = headings
      .map(
        (h) =>
          `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${h}</w:t></w:r></w:p>` +
          `<w:p><w:r><w:t>Placeholder body for ${h}.</w:t></w:r></w:p>`,
      )
      .join("");
    return writeZip([
      { name: "word/document.xml", bytes: Buffer.from(`<w:document ${NS}><w:body>${body}</w:body></w:document>`, "utf8") },
    ]);
  }

  const file = arg("file");
  const tenantId = arg("tenant") ?? "eval";
  const expected = (arg("expect") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  let bytes: Buffer;
  let expectedLabels: string[];
  if (file) {
    bytes = readFileSync(file);
    expectedLabels = expected;
  } else {
    const headings = ["Executive Summary", "Proposed Solution", "Pricing", "Next Steps"];
    bytes = sampleDocx(headings);
    expectedLabels = expected.length ? expected : headings;
  }

  const { text, outline } = extractDocxText(bytes);
  console.log(`Source: ${file ?? "(synthetic)"} — ${outline.length} headings, ${text.length} chars`);

  const { componentMap, meta } = await detectComponents(text, outline, { tenantId });
  const labels = componentMap.components.map((c) => c.label);

  console.log("\n=== Detection scorecard ===");
  console.log(`model: ${meta.model} | components: ${meta.componentCount} | truncated: ${meta.truncated}`);
  console.log(`detected: ${labels.join(" | ")}`);

  if (expectedLabels.length) {
    const cov = gradeDetectionCoverage(expectedLabels, labels);
    console.log(`coverage: ${(cov.coverage * 100).toFixed(0)}%  | missing: ${cov.missing.join(", ") || "none"}`);
  }
  const ph = gradePlaceholders(componentMap.components.map((c) => ({ content: c.label })));
  console.log(`labels clean of placeholders: ${ph.clean}`);
  console.log("\n(For fill + trust scoring, run the live app: /proposals -> fill from a real deal.)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
