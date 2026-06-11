import { describe, it, expect } from "vitest";
import { resolveActorName } from "../actor-name";

const names = new Map<string, string>([["u1", "Marie Curie"]]);

describe("resolveActorName", () => {
  it("names a user-attributed action", () => {
    expect(resolveActorName("user", "u1", names)).toBe("Marie Curie");
  });
  it("returns null for a system action", () => {
    expect(resolveActorName("system", "u1", names)).toBeNull();
  });
  it("returns null for an inbound-from-contact action", () => {
    expect(resolveActorName("contact", "anything", names)).toBeNull();
  });
  it("returns null for a null/empty actor id (legacy rows)", () => {
    expect(resolveActorName("user", null, names)).toBeNull();
    expect(resolveActorName("user", "", names)).toBeNull();
  });
  it("returns null when the user id resolves to no member (fallback to anonymous)", () => {
    expect(resolveActorName("user", "ghost", names)).toBeNull();
  });
});
