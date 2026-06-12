/**
 * generateCallScript × tenant Knowledge: the founder's editable cold-call
 * playbook (Settings → Knowledge, category "process", title "Cold call …")
 * must be injected into the generation prompt — capped, filtered, and
 * fail-soft (a knowledge outage never blocks script generation).
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const generateMock = vi.fn();
const knowledgeMock = vi.fn();
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
  getTenantKnowledge: (...a: unknown[]) => knowledgeMock(...a),
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
};
const PRODUCT_ENTRY = {
  id: "k2",
  topic: "Offre Pilae Cloud",
  content: "Pods managés souverains.",
  category: "product",
};

beforeEach(() => {
  generateMock.mockReset();
  knowledgeMock.mockReset();
  settingsMock.mockReset();
  process.env.ANTHROPIC_API_KEY = "sk-test";
  generateMock.mockResolvedValue(VALID_OBJECT);
  settingsMock.mockResolvedValue({ productDescription: "Pilae Cloud", targetIndustries: ["santé"] });
  knowledgeMock.mockResolvedValue([]);
});

afterAll(() => {
  if (prevAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
});

describe("buildPlaybookBlock (pure)", () => {
  it("keeps only process entries titled 'Cold call …'", () => {
    const block = buildPlaybookBlock([
      PLAYBOOK_ENTRY,
      PRODUCT_ENTRY,
      { id: "k3", topic: "Onboarding interne", content: "x", category: "process" },
    ]);
    expect(block).toContain("FOUNDER COLD-CALL PLAYBOOK");
    expect(block).toContain("ouverture fondateur");
    expect(block).not.toContain("Pilae Cloud");
    expect(block).not.toContain("Onboarding interne");
  });

  it("matches 'cold-call' and 'coldcall' title variants, case-insensitive", () => {
    for (const topic of ["cold-call rules", "ColdCall — pivot", "COLD CALL x"]) {
      expect(buildPlaybookBlock([{ ...PLAYBOOK_ENTRY, topic }])).toContain(topic);
    }
  });

  it("returns empty string when nothing matches", () => {
    expect(buildPlaybookBlock([])).toBe("");
    expect(buildPlaybookBlock([PRODUCT_ENTRY])).toBe("");
  });

  it("caps the block — an entry that would overflow is dropped, earlier ones kept", () => {
    const big = { ...PLAYBOOK_ENTRY, id: "kBig", topic: "Cold call — annexe", content: "x".repeat(5000) };
    const block = buildPlaybookBlock([PLAYBOOK_ENTRY, big], 500);
    expect(block).toContain("ouverture fondateur");
    expect(block).not.toContain("annexe");
    expect(block.length).toBeLessThan(800);
  });

  it("flattens entry content whitespace (multi-line entries stay one bullet)", () => {
    const block = buildPlaybookBlock([{ ...PLAYBOOK_ENTRY, content: "ligne 1\n\nligne   2" }]);
    expect(block).toContain("ligne 1 ligne 2");
  });
});

describe("generateCallScript prompt wiring", () => {
  it("injects the playbook block when Cold call knowledge exists", async () => {
    knowledgeMock.mockResolvedValue([PLAYBOOK_ENTRY, PRODUCT_ENTRY]);
    const res = await generateCallScript("tenant-1");
    expect(res).not.toBeNull();
    expect(knowledgeMock).toHaveBeenCalledWith("tenant-1");
    const prompt = (generateMock.mock.calls[0][0] as { prompt: string }).prompt;
    expect(prompt).toContain("FOUNDER COLD-CALL PLAYBOOK");
    expect(prompt).toContain("Se présenter co-fondateur");
    expect(prompt).not.toContain("Pods managés souverains");
  });

  it("omits the block entirely when the tenant has no Cold call knowledge", async () => {
    const res = await generateCallScript("tenant-1");
    expect(res).not.toBeNull();
    const prompt = (generateMock.mock.calls[0][0] as { prompt: string }).prompt;
    expect(prompt).not.toContain("FOUNDER COLD-CALL PLAYBOOK");
  });

  it("fail-soft: a knowledge read error never blocks generation", async () => {
    knowledgeMock.mockRejectedValue(new Error("table missing"));
    const res = await generateCallScript("tenant-1");
    expect(res).not.toBeNull();
    expect(res!.draft.opener).toContain("{name}");
    const prompt = (generateMock.mock.calls[0][0] as { prompt: string }).prompt;
    expect(prompt).not.toContain("FOUNDER COLD-CALL PLAYBOOK");
  });
});
