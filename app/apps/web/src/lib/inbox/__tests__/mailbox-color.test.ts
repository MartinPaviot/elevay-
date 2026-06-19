import { describe, it, expect } from "vitest";
import { colorForMailbox, MAILBOX_PALETTE } from "@/lib/inbox/mailbox-color";

describe("colorForMailbox", () => {
  it("is deterministic — same id maps to the same token across calls", () => {
    expect(colorForMailbox("mb_abc")).toBe(colorForMailbox("mb_abc"));
  });
  it("is total — returns a palette token for random, empty, and unicode ids", () => {
    for (const id of ["", "x", "mb_123", "boîte-é", "🙂", "a".repeat(200)]) {
      expect(MAILBOX_PALETTE).toContain(colorForMailbox(id));
    }
    expect(MAILBOX_PALETTE).toContain(colorForMailbox(null));
    expect(MAILBOX_PALETTE).toContain(colorForMailbox(undefined));
  });
  it("nullish/empty maps to the fixed fallback slot", () => {
    expect(colorForMailbox("")).toBe(MAILBOX_PALETTE[0]);
    expect(colorForMailbox(null)).toBe(MAILBOX_PALETTE[0]);
  });
  it("is stable on add/remove — removing an id never recolors the others", () => {
    const ids = ["mb_1", "mb_2", "mb_3", "mb_4"];
    const before = Object.fromEntries(ids.map((i) => [i, colorForMailbox(i)]));
    const after = Object.fromEntries(["mb_1", "mb_3", "mb_4"].map((i) => [i, colorForMailbox(i)]));
    for (const i of ["mb_1", "mb_3", "mb_4"]) expect(after[i]).toBe(before[i]);
  });
  it("uses tokens only — every palette entry is a var(--color-*)", () => {
    for (const c of MAILBOX_PALETTE) expect(c.startsWith("var(--color")).toBe(true);
  });
  it("distributes across the palette (not all one slot)", () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => colorForMailbox(`mb_${i}`)));
    expect(seen.size).toBeGreaterThan(1);
  });
});
