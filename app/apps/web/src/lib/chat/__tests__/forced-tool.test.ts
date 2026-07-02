import { describe, expect, it } from "vitest";
import { resolveForcedTool } from "../forced-tool";

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

  it("non-string hint is ignored", () => {
    const chat = {};
    expect(resolveForcedTool(123 as unknown as string, chat, capability).toolName).toBeNull();
  });
});
