import { describe, expect, it } from "vitest";
import { humanizeMemoryKey } from "@/lib/agents/agent-memory";

describe("humanizeMemoryKey", () => {
  it("turns a snake_case retrieval slug into a human label", () => {
    expect(humanizeMemoryKey("communication_style")).toBe("Communication style");
    expect(humanizeMemoryKey("deal_strategy_acme")).toBe("Deal strategy acme");
  });
  it("handles hyphens and mixed separators", () => {
    expect(humanizeMemoryKey("preferred-tone")).toBe("Preferred tone");
    expect(humanizeMemoryKey("a_b-c")).toBe("A b c");
  });
  it("degrades gracefully on empty / separator-only keys", () => {
    expect(humanizeMemoryKey("")).toBe("Memory");
    expect(humanizeMemoryKey("___")).toBe("Memory");
  });
  it("leaves an already-clean key readable", () => {
    expect(humanizeMemoryKey("budget")).toBe("Budget");
  });
});
