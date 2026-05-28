import { describe, expect, it } from "vitest";
import {
  MAX_BATCH_SIZE,
  findMissingIds,
  validateBulkApprove,
  validateBulkInput,
  type DraftForBulkValidation,
} from "@/lib/sequence-drafts/bulk-approve";

describe("validateBulkInput", () => {
  it("accepts a normal batch of string ids", () => {
    expect(validateBulkInput(["d1", "d2", "d3"])).toEqual({
      ok: true,
      ids: ["d1", "d2", "d3"],
    });
  });

  it("rejects non-array input", () => {
    expect(validateBulkInput("not-an-array")).toEqual({
      ok: false,
      error: "`ids` must be an array",
    });
    expect(validateBulkInput(null)).toEqual({
      ok: false,
      error: "`ids` must be an array",
    });
    expect(validateBulkInput(undefined)).toEqual({
      ok: false,
      error: "`ids` must be an array",
    });
  });

  it("rejects an empty array", () => {
    expect(validateBulkInput([])).toEqual({
      ok: false,
      error: "`ids` cannot be empty",
    });
  });

  it("rejects batches above the maximum size", () => {
    const ids = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => `d${i}`);
    expect(validateBulkInput(ids)).toEqual({
      ok: false,
      error: `Maximum ${MAX_BATCH_SIZE} drafts per batch (got ${MAX_BATCH_SIZE + 1})`,
    });
  });

  it("accepts a batch exactly at the maximum size", () => {
    const ids = Array.from({ length: MAX_BATCH_SIZE }, (_, i) => `d${i}`);
    const result = validateBulkInput(ids);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ids).toHaveLength(MAX_BATCH_SIZE);
    }
  });

  it("rejects when any element is non-string", () => {
    expect(validateBulkInput(["d1", 42, "d3"])).toEqual({
      ok: false,
      error: "All ids must be non-empty strings",
    });
  });

  it("rejects empty strings (would cause a select-all match)", () => {
    expect(validateBulkInput(["d1", "", "d3"])).toEqual({
      ok: false,
      error: "All ids must be non-empty strings",
    });
  });

  it("dedupes repeated ids (caller may pass the same draft twice)", () => {
    const result = validateBulkInput(["d1", "d2", "d1", "d3", "d2"]);
    expect(result).toEqual({ ok: true, ids: ["d1", "d2", "d3"] });
  });
});

describe("validateBulkApprove", () => {
  it("returns ok=true with no failures when every draft is pending_approval", () => {
    expect(
      validateBulkApprove([
        { id: "d1", status: "pending_approval" },
        { id: "d2", status: "pending_approval" },
        { id: "d3", status: "pending_approval" },
      ]),
    ).toEqual({ ok: true, failures: [] });
  });

  it("returns ok=false listing every non-pending draft (batch fails whole)", () => {
    const result = validateBulkApprove([
      { id: "d1", status: "pending_approval" },
      { id: "d2", status: "approved" },
      { id: "d3", status: "rejected" },
      { id: "d4", status: "pending_approval" },
      { id: "d5", status: "expired" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.id)).toEqual(["d2", "d3", "d5"]);
    // Reasons should be informative (echo the state machine)
    expect(result.failures[0].reason).toMatch(/approved/);
    expect(result.failures[1].reason).toMatch(/rejected/);
    expect(result.failures[2].reason).toMatch(/expired/);
  });

  it("fails the whole batch on a single bad draft (atomicity guarantee)", () => {
    const drafts: DraftForBulkValidation[] = Array.from(
      { length: 10 },
      (_, i) => ({ id: `d${i}`, status: "pending_approval" }),
    );
    // Swap one to a non-pending state to simulate the parallel-reviewer
    // race that the atomicity guarantee is designed to catch.
    drafts[5] = { id: "d5", status: "sent" };
    const result = validateBulkApprove(drafts);
    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].id).toBe("d5");
  });

  it("accepts an empty list (no-op, returns ok)", () => {
    // The endpoint guards against empty in validateBulkInput first;
    // this is just the math contract of the helper.
    expect(validateBulkApprove([])).toEqual({ ok: true, failures: [] });
  });
});

describe("findMissingIds", () => {
  it("returns empty when all ids were found", () => {
    expect(
      findMissingIds(["d1", "d2"], [{ id: "d1" }, { id: "d2" }]),
    ).toEqual([]);
  });

  it("returns the ids that were absent from the lookup", () => {
    expect(
      findMissingIds(
        ["d1", "d2", "d3", "d4"],
        [{ id: "d1" }, { id: "d3" }],
      ),
    ).toEqual(["d2", "d4"]);
  });

  it("preserves input order in the missing list", () => {
    expect(
      findMissingIds(["z", "a", "m"], [{ id: "a" }]),
    ).toEqual(["z", "m"]);
  });

  it("returns all requested when nothing was found (cross-tenant attempt)", () => {
    expect(findMissingIds(["d1", "d2"], [])).toEqual(["d1", "d2"]);
  });
});
