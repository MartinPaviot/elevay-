/**
 * classifyStages — the "write normally" contract: stages come from the
 * content via one constrained LLM step, validated verbatim against the
 * taxonomy, and EVERY failure path lands on the category/title derivation
 * (never a blocker, never an invented stage).
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const generateMock = vi.fn();

vi.mock("@/lib/ai/traced-ai", () => ({
  tracedGenerateObject: (...a: unknown[]) => generateMock(...a),
}));
vi.mock("@/lib/ai/ai-provider", () => ({ anthropic: vi.fn(() => "anthropic-model") }));
vi.mock("@ai-sdk/openai", () => ({ openai: Object.assign(vi.fn(() => "openai-model"), { embedding: vi.fn() }) }));

import { classifyStages } from "@/lib/knowledge/auto-stage";

const prevAnthropic = process.env.ANTHROPIC_API_KEY;
const prevOpenai = process.env.OPENAI_API_KEY;

beforeEach(() => {
  generateMock.mockReset();
  process.env.ANTHROPIC_API_KEY = "sk-test";
});

afterAll(() => {
  if (prevAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = prevAnthropic;
  if (prevOpenai === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = prevOpenai;
});

describe("classifyStages", () => {
  it("keeps validated stages from the model", async () => {
    generateMock.mockResolvedValue({ object: { stages: ["objections", "cold_call", "made_up"] } });
    expect(await classifyStages("Réponses objection prix", "Quand le prospect dit trop cher...", "t1")).toEqual([
      "objections",
      "cold_call",
    ]);
  });

  it("falls back to derivation when the model returns only junk", async () => {
    generateMock.mockResolvedValue({ object: { stages: ["nonsense"] } });
    expect(await classifyStages("Notes", "contenu", "t1", "icp")).toEqual(["sourcing"]);
  });

  it("falls back on LLM error, empty content, or no model key", async () => {
    generateMock.mockRejectedValue(new Error("down"));
    expect(await classifyStages("Notes", "contenu", "t1", "objections")).toEqual(["objections", "cold_call"]);

    expect(await classifyStages("Notes", "   ", "t1")).toEqual(["global"]);
    expect(generateMock).toHaveBeenCalledTimes(1); // empty content never calls the model

    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY; // vitest env may carry one
    expect(await classifyStages("Notes", "contenu", "t1")).toEqual(["global"]);
    expect(generateMock).toHaveBeenCalledTimes(1); // no key → no call
  });
});
