/**
 * formatKnowledgeIndex — the always-on chat map of the knowledge base:
 * titles grouped under the stage they serve, instruction to fetch full
 * content via getKnowledge, capped, deriving stages for uncurated rows.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ knowledgeEntries: {} }));

import { formatKnowledgeIndex } from "@/lib/knowledge/get-tenant-knowledge";

describe("formatKnowledgeIndex", () => {
  it("groups titles under their primary stage label and points to getKnowledge", () => {
    const out = formatKnowledgeIndex([
      { title: "Cold call — Phase 1", category: "process", stages: ["cold_call"] },
      { title: "Company — Identity & legal", category: "context", stages: ["global"] },
      { title: "Pricing notes", category: "pricing", stages: [] }, // uncurated custom category → derived global
    ]);
    expect(out).toContain("## Knowledge Index");
    expect(out).toContain("getKnowledge");
    expect(out).toContain('Cold calls:\n- "Cold call — Phase 1" (process)');
    expect(out).toContain("Everywhere:");
    expect(out).toContain('"Company — Identity & legal" (context)');
    expect(out).toContain('"Pricing notes" (pricing)');
    // pipeline order: cold_call section before the global one
    expect(out.indexOf("Cold calls:")).toBeLessThan(out.indexOf("Everywhere:"));
  });

  it("returns empty string for an empty base and respects the cap", () => {
    expect(formatKnowledgeIndex([])).toBe("");
    const many = Array.from({ length: 80 }, (_, i) => ({
      title: `Entry ${i}`,
      category: "custom",
      stages: ["global"],
    }));
    const out = formatKnowledgeIndex(many, 60);
    expect(out).toContain("Entry 59");
    expect(out).not.toContain("Entry 60");
  });
});
