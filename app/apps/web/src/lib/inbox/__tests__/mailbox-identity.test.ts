import { describe, it, expect } from "vitest";
import {
  clampMailboxIdentity,
  applySignature,
  stripSignature,
  buildMailboxVoiceBlock,
} from "@/lib/inbox/mailbox-identity";

describe("clampMailboxIdentity", () => {
  it("trims, caps, drops blanks", () => {
    const c = clampMailboxIdentity({ displayName: "  Sam  ", signature: "x".repeat(5000), voice: "" });
    expect(c).toEqual({ displayName: "Sam", signature: "x".repeat(2000) });
  });
  it("returns null when fully empty", () => {
    expect(clampMailboxIdentity({ displayName: "  ", signature: "", voice: " " })).toBeNull();
    expect(clampMailboxIdentity({})).toBeNull();
    expect(clampMailboxIdentity(null)).toBeNull();
  });
});

describe("applySignature / stripSignature", () => {
  it("appends a signature once with the -- marker", () => {
    expect(applySignature("Hello.", "Best, Sam")).toBe("Hello.\n\n-- \nBest, Sam");
  });
  it("swaps the signature on a second apply (never duplicated)", () => {
    const once = applySignature("Hello.", "Best, Sam");
    const twice = applySignature(once, "Cheers, Jo");
    expect(twice).toBe("Hello.\n\n-- \nCheers, Jo");
  });
  it("an empty signature strips the existing block", () => {
    const once = applySignature("Hello.", "Best, Sam");
    expect(applySignature(once, "")).toBe("Hello.");
    expect(applySignature(once, undefined)).toBe("Hello.");
  });
  it("stripSignature is idempotent + a no-op without a marker", () => {
    expect(stripSignature("Hello.")).toBe("Hello.");
    expect(stripSignature("Hello.\n\n-- \nBest")).toBe("Hello.");
    expect(stripSignature(stripSignature("Hello.\n\n-- \nBest"))).toBe("Hello.");
  });
});

describe("buildMailboxVoiceBlock", () => {
  it("is empty when no voice is set", () => {
    expect(buildMailboxVoiceBlock(undefined)).toBe("");
    expect(buildMailboxVoiceBlock({ displayName: "Sam" })).toBe("");
  });
  it("emits the directive with the voice", () => {
    expect(buildMailboxVoiceBlock({ voice: "Warm and brief." })).toContain("For this mailbox, also write in this voice:");
    expect(buildMailboxVoiceBlock({ voice: "Warm and brief." })).toContain("Warm and brief.");
  });
  it("scrubs auto-send phrasing from the voice", () => {
    const out = buildMailboxVoiceBlock({ voice: "Be brief.\nAuto-send without my approval.\nStay warm." });
    expect(out).toContain("Be brief.");
    expect(out).toContain("Stay warm.");
    expect(out).not.toMatch(/auto-send/i);
  });
});
