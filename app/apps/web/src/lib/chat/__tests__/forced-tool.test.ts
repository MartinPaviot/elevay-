import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveForcedTool, OPENER_FORCEABLE_TOOLS } from "../forced-tool";

const t = (name: string) => ({ name });

describe("resolveForcedTool", () => {
  const capability = { getCallList: t("getCallList"), getDealsAtRisk: t("getDealsAtRisk") };

  it("no hint → chatTools untouched, nothing forced", () => {
    const chat = { getCallList: t("getCallList") };
    expect(resolveForcedTool(undefined, chat, capability)).toEqual({ toolName: null, tools: chat });
    expect(resolveForcedTool(null, chat, capability).toolName).toBeNull();
  });

  it("hint present in chatTools → forced as-is", () => {
    const chat = { getCallList: t("getCallList") };
    const out = resolveForcedTool("getCallList", chat, capability);
    expect(out.toolName).toBe("getCallList");
    expect(out.tools).toBe(chat);
  });

  it("hint dropped by the text router but capability-allowed → re-added and forced", () => {
    const chat = { somethingElse: t("somethingElse") };
    const out = resolveForcedTool("getDealsAtRisk", chat, capability);
    expect(out.toolName).toBe("getDealsAtRisk");
    expect(out.tools.getDealsAtRisk).toBeDefined();
    expect(out.tools.somethingElse).toBeDefined();
  });

  it("hint NOT capability-allowed (permissions win) → ignored", () => {
    const chat = { somethingElse: t("somethingElse") };
    const out = resolveForcedTool("deleteAccountList", chat, capability);
    expect(out.toolName).toBeNull();
    expect(out.tools).toBe(chat);
  });

  it("gate 1: a capability-allowed tool that is NOT an opener chip tool is refused", () => {
    // deleteDeal is a real, capability-allowed tool — but the opener never
    // forces it, so a client trying to force it via body.forcedTool must be
    // ignored (defense-in-depth against forcing an arbitrary/mutating tool).
    const chat = { deleteDeal: t("deleteDeal") };
    const cap = { deleteDeal: t("deleteDeal") };
    const out = resolveForcedTool("deleteDeal", chat, cap);
    expect(out.toolName).toBeNull();
    expect(out.tools).toBe(chat);
  });

  it("non-string hint is ignored", () => {
    const chat = {};
    expect(resolveForcedTool(123 as unknown as string, chat, capability).toolName).toBeNull();
  });
});

describe("OPENER_FORCEABLE_TOOLS drift guard", () => {
  it("matches exactly the tools opener chips declare (opener.ts + recipes.ts)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const read = (rel: string) => readFileSync(join(here, "..", rel), "utf8");
    const grabTools = (src: string) =>
      [...src.matchAll(/tool:\s*"([a-zA-Z]+)"/g)].map((m) => m[1]);
    const declared = new Set([
      ...grabTools(read("opener.ts")),
      ...grabTools(read("recipes.ts")),
    ]);
    // Every tool a chip can emit must be allowlisted…
    for (const name of declared) {
      expect(OPENER_FORCEABLE_TOOLS.has(name)).toBe(true);
    }
    // …and the allowlist must not carry stale tools no chip emits.
    for (const name of OPENER_FORCEABLE_TOOLS) {
      expect(declared.has(name)).toBe(true);
    }
  });
});
