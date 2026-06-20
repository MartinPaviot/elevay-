import { describe, it, expect } from "vitest";
import { createLoadGuard } from "../load-guard";

/**
 * F2 B2.1/B2.2 — the load-generation guard. next() issues increasing tokens; only
 * the latest is current, so an earlier load that resolves last is discarded.
 */

describe("createLoadGuard", () => {
  it("issues strictly increasing tokens", () => {
    const g = createLoadGuard();
    expect(g.next()).toBe(1);
    expect(g.next()).toBe(2);
    expect(g.next()).toBe(3);
  });

  it("only the latest token is current", () => {
    const g = createLoadGuard();
    const a = g.next();
    const b = g.next();
    expect(g.isCurrent(a)).toBe(false);
    expect(g.isCurrent(b)).toBe(true);
  });

  it("an old token is never current again after next()", () => {
    const g = createLoadGuard();
    const a = g.next();
    expect(g.isCurrent(a)).toBe(true);
    g.next();
    expect(g.isCurrent(a)).toBe(false);
  });

  it("models two overlapping loads: the earlier one (A), resolving last, is skipped", () => {
    // A issued, then B issued; A resolves after B -> A's commit must be skipped.
    const g = createLoadGuard();
    const tokenA = g.next();
    const tokenB = g.next();
    // ... B resolves first and commits (current) ...
    expect(g.isCurrent(tokenB)).toBe(true);
    // ... then A resolves last and tries to commit ...
    expect(g.isCurrent(tokenA)).toBe(false); // discarded — no stale-lane flash
  });

  it("a token of 0 (never issued) is not current", () => {
    const g = createLoadGuard();
    g.next();
    expect(g.isCurrent(0)).toBe(false);
  });
});
