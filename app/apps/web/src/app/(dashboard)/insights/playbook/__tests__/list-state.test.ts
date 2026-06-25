import { describe, it, expect } from "vitest";
import { playbookListState } from "../_list-state";

describe("playbookListState (P1 27)", () => {
  it("first paint with nothing loaded → initial-loading", () => {
    expect(playbookListState(true, 0)).toBe("initial-loading");
  });

  it("re-fetch with cards already shown → refreshing (not silent-stale)", () => {
    expect(playbookListState(true, 5)).toBe("refreshing");
  });

  it("settled and empty → empty", () => {
    expect(playbookListState(false, 0)).toBe("empty");
  });

  it("settled with cards → list", () => {
    expect(playbookListState(false, 5)).toBe("list");
  });

  it("never reports empty while a fetch is in flight with cards present", () => {
    // The defect being guarded: loading + count>0 must NOT fall through to
    // 'empty' or 'list' (which would hide that a refetch is happening).
    expect(playbookListState(true, 1)).toBe("refreshing");
  });
});
