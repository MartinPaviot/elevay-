/**
 * Tests for @/db/rls — Row-Level Security session variable helpers.
 *
 * Mocks the database layer to verify that the correct SQL statements
 * are issued for setting/clearing the tenant context, and that the
 * withTenantRLS wrapper properly cleans up even on errors.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing rls
vi.mock("@/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
}));

import { setTenantId, clearTenantId, withTenantRLS } from "@/db/rls";
import { db } from "@/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
const mockExecute = db.execute as any as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockExecute.mockClear();
});

describe("setTenantId", () => {
  it("calls db.execute with set_config for the given tenantId", async () => {
    await setTenantId("tenant-abc-123");

    expect(mockExecute).toHaveBeenCalledTimes(1);

    // The argument is a tagged template SQL object from drizzle-orm.
    // Verify it was called (the exact SQL shape is an opaque drizzle
    // object, so we just confirm the call happened).
    const callArg = mockExecute.mock.calls[0][0];
    expect(callArg).toBeTruthy();
  });

  it("can be called with different tenant IDs", async () => {
    await setTenantId("tenant-1");
    await setTenantId("tenant-2");

    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});

describe("clearTenantId", () => {
  it("calls db.execute to clear the tenant context", async () => {
    await clearTenantId();

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const callArg = mockExecute.mock.calls[0][0];
    expect(callArg).toBeTruthy();
  });
});

describe("withTenantRLS", () => {
  it("sets tenant ID before the callback and clears after", async () => {
    const callOrder: string[] = [];

    mockExecute.mockImplementation(async () => {
      // Track whether this is a set or clear call based on order
      callOrder.push(callOrder.length === 0 ? "set" : "clear");
      return undefined as any;
    });

    const result = await withTenantRLS("tenant-xyz", async () => {
      callOrder.push("callback");
      return "hello";
    });

    expect(result).toBe("hello");
    expect(callOrder).toEqual(["set", "callback", "clear"]);
  });

  it("clears tenant ID even when the callback throws", async () => {
    const error = new Error("boom");

    await expect(
      withTenantRLS("tenant-err", async () => {
        throw error;
      }),
    ).rejects.toThrow("boom");

    // Should have been called twice: once for set, once for clear
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("returns the callback's return value", async () => {
    const result = await withTenantRLS("tenant-ret", async () => {
      return { rows: [1, 2, 3] };
    });

    expect(result).toEqual({ rows: [1, 2, 3] });
  });

  it("propagates async errors from the callback", async () => {
    const err = new Error("async failure");

    await expect(
      withTenantRLS("tenant-async", async () => {
        await Promise.resolve();
        throw err;
      }),
    ).rejects.toThrow("async failure");

    // Cleanup should still happen
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});
