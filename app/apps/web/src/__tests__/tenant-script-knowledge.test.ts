/**
 * generateCallScript × tenant Knowledge: the founder's editable cold-call
 * playbook is pulled by STAGE ("cold_call", global excluded) and injected
 * into the generation prompt — capped, deduped, and fail-soft (a knowledge
 * outage never blocks script generation).
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const generateMock = vi.fn();
const knowledgeStageMock = vi.fn();
const settingsMock = vi.fn();

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ callScripts: {} }));
vi.mock("@/lib/ai/ai-provider", () => ({ anthropic: vi.fn(() => "anthropic-model") }));
vi.mock("@ai-sdk/openai", () => ({ openai: Object.assign(vi.fn(() => "openai-model"), { embedding: vi.fn() }) }));
vi.mock("@/lib/ai/traced-ai", () => ({
  tracedGenerateObject: (...a: unknown[]) => generateMock(...a),
}));
vi.mock("@/lib/config/tenant-settings", () => ({
  getTenantSettings: (...a: unknown[]) => settingsMock(...a),
}));
vi.mock("@/lib/knowledge/get-tenant-knowledge", () => ({
  getTenantKnowledgeForStage: (...a: unknown[]) => knowledgeStageMock(...a),
}));

import { buildPlaybookBlock, generateCallScript } from "@/lib/call-mode/tenant-script";

const prevAnthropicKey = process.env.ANTHROPIC_API_KEY;

const VALID_OBJECT = {
  object: {
    opener: "Bonjour {name}, Martin Paviot, co-fondateur de Pilae. Vous avez deux minutes ?",
    problems: [{ text: "une facture logicielle qui grimpe", evidenceRef: null }],
    permissionCheck: "Est-ce que c'est un sujet chez vous ?",
    bookingAsk: "On se cale 45 minutes en début ou fin de semaine ?",
  },
};

const PLAYBOOK_ENTRY = {
  id: "k1",
  topic: "Cold call — Phase 1 : ouverture fondateur",
  content: "Se présenter co-fondateur, demander 30 secondes de permission.",
  category: "process",
  stages: ["cold_call"],
};

beforeEach(() => {
  generateMock.mockReset();
  knowledgeStageMock.mockReset();
  settingsMock.mockReset();
  process.env.ANTHROPIC_API_KEY = "sk-test";
  generateMock.mockResolvedValue(VALID_OBJECT);
  settingsMock.mockResolvedValue({ productDescription: "Pilae Cloud", targetIndustries: ["santé"] });
  knowledgeStageMock.mockResolvedValue([]);
});

afterAll(() => {
  if (prevAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
});

describe("buildPlaybookBlock (pure formatter)", () => {
  it("formats the given entries and dedupes repeated topics", () => {
    const block = buildPlaybookBlock([
      PLAYBOOK_ENTRY,
      { ...PLAYBOOK_ENTRY, id: "k1b" }, // same topic — deduped
      { id: "k2", topic: "Cold call — Pivot", content: "Trois sorties.", category: "process", stages: ["cold_call"] },
    ]);
    expect(block).toContain("FOUNDER COLD-CALL PLAYBOOK");
    expect(block.match(/ouverture fondateur/g)).toHaveLength(1);
    expect(block).toContain("Trois sorties.");
  });

  it("returns empty string for no entries", () => {
    expect(buildPlaybookBlock([])).toBe("");
  });

  it("caps the block — an entry that would overflow is dropped, earlier ones kept", () => {
    const big = { id: "kBig", topic: "Annexe", content: "x".repeat(5000) };
    const block = buildPlaybookBlock([PLAYBOOK_ENTRY, big], 500);
    expect(block).toContain("ouverture fondateur");
    expect(block).not.toContain("Annexe");
    expect(block.length).toBeLessThan(800);
  });

  it("flattens entry content whitespace (multi-line entries stay one bullet)", () => {
    const block = buildPlaybookBlock([{ ...PLAYBOOK_ENTRY, content: "ligne 1\n\nligne   2" }]);
    expect(block).toContain("ligne 1 ligne 2");
  });
});

describe("generateCallScript prompt wiring", () => {
  it("pulls the cold_call stage (global excluded) and injects the block", async () => {
    knowledgeStageMock.mockResolvedValue([PLAYBOOK_ENTRY]);
    const res = await generateCallScript("tenant-1");
    expect(res).not.toBeNull();
    expect(knowledgeStageMock).toHaveBeenCalledWith("tenant-1", "cold_call", { includeGlobal: false });
    const prompt = (generateMock.mock.calls[0][0] as { prompt: string }).prompt;
    expect(prompt).toContain("FOUNDER COLD-CALL PLAYBOOK");
    expect(prompt).toContain("Se présenter co-fondateur");
  });

  it("omits the block entirely when the stage pull is empty", async () => {
    const res = await generateCallScript("tenant-1");
    expect(res).not.toBeNull();
    const prompt = (generateMock.mock.calls[0][0] as { prompt: string }).prompt;
    expect(prompt).not.toContain("FOUNDER COLD-CALL PLAYBOOK");
  });

  it("fail-soft: a knowledge read error never blocks generation", async () => {
    knowledgeStageMock.mockRejectedValue(new Error("table missing"));
    const res = await generateCallScript("tenant-1");
    expect(res).not.toBeNull();
    expect(res!.draft.opener).toContain("{name}");
    const prompt = (generateMock.mock.calls[0][0] as { prompt: string }).prompt;
    expect(prompt).not.toContain("FOUNDER COLD-CALL PLAYBOOK");
  });
});
