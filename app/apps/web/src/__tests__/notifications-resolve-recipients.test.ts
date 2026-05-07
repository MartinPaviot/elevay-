import { describe, it, expect, vi } from "vitest";
import {
  pickRecipients,
  resolveTenantRecipients,
  RESOLVE_RECIPIENTS_LIMITS,
} from "@/lib/notifications/resolve-recipients";

describe("pickRecipients", () => {
  it("returns admin user ids exclusively when admins exist", () => {
    const users = [
      { id: "u1", role: "admin" },
      { id: "u2", role: "member" },
      { id: "u3", role: "admin" },
    ];
    expect(pickRecipients(users)).toEqual(["u1", "u3"]);
  });

  it("falls back to all users when no admin exists", () => {
    const users = [
      { id: "u1", role: "member" },
      { id: "u2", role: "member" },
    ];
    expect(pickRecipients(users)).toEqual(["u1", "u2"]);
  });

  it("returns empty array when input is empty", () => {
    expect(pickRecipients([])).toEqual([]);
  });

  it("caps at MAX_RECIPIENTS (5)", () => {
    const users = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      role: "member" as const,
    }));
    const out = pickRecipients(users);
    expect(out.length).toBe(RESOLVE_RECIPIENTS_LIMITS.MAX_RECIPIENTS);
    expect(out).toEqual(["u0", "u1", "u2", "u3", "u4"]);
  });

  it("caps admins at MAX_RECIPIENTS too", () => {
    const users = Array.from({ length: 10 }, (_, i) => ({
      id: `a${i}`,
      role: "admin" as const,
    }));
    expect(pickRecipients(users).length).toBe(
      RESOLVE_RECIPIENTS_LIMITS.MAX_RECIPIENTS,
    );
  });

  it("treats null role as non-admin", () => {
    const users = [
      { id: "u1", role: null },
      { id: "u2", role: "admin" },
    ];
    expect(pickRecipients(users)).toEqual(["u2"]);
  });

  it("treats unknown role as non-admin", () => {
    const users = [
      { id: "u1", role: "viewer" },
      { id: "u2", role: "admin" },
    ];
    expect(pickRecipients(users)).toEqual(["u2"]);
  });
});

describe("resolveTenantRecipients", () => {
  it("returns admin source when admins exist", async () => {
    const result = await resolveTenantRecipients({
      tenantId: "t-1",
      deps: {
        findTenantUsers: vi.fn(async () => [
          { id: "u1", role: "admin" },
          { id: "u2", role: "member" },
        ]),
      },
    });
    expect(result).toEqual({ userIds: ["u1"], source: "admin" });
  });

  it("returns all_users source when no admin", async () => {
    const result = await resolveTenantRecipients({
      tenantId: "t-1",
      deps: {
        findTenantUsers: vi.fn(async () => [{ id: "u1", role: "member" }]),
      },
    });
    expect(result).toEqual({ userIds: ["u1"], source: "all_users" });
  });

  it("returns none source when tenant has zero users", async () => {
    const result = await resolveTenantRecipients({
      tenantId: "t-1",
      deps: { findTenantUsers: vi.fn(async () => []) },
    });
    expect(result).toEqual({ userIds: [], source: "none" });
  });

  it("passes the tenantId through to the dep", async () => {
    const findSpy = vi.fn(async () => []);
    await resolveTenantRecipients({
      tenantId: "t-xyz",
      deps: { findTenantUsers: findSpy },
    });
    expect(findSpy).toHaveBeenCalledWith("t-xyz");
  });
});
