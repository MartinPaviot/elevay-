import { describe, it, expect } from "vitest";
import {
  readTenantFixtures,
  validateTenantFixtures,
  composeFixtures,
  type TenantFixture,
} from "@/lib/evals/tenant-fixtures";

describe("readTenantFixtures", () => {
  it("returns empty when settings is null/undefined/empty", () => {
    expect(readTenantFixtures(null, "x")).toEqual([]);
    expect(readTenantFixtures(undefined, "x")).toEqual([]);
    expect(readTenantFixtures({}, "x")).toEqual([]);
  });

  it("returns empty when the surface bucket is missing", () => {
    expect(
      readTenantFixtures(
        { eval_fixtures: { other_surface: [] } },
        "transcript-coaching-grounded",
      ),
    ).toEqual([]);
  });

  it("returns empty when bucket isn't an array", () => {
    expect(
      readTenantFixtures(
        { eval_fixtures: { x: "not-an-array" } },
        "x",
      ),
    ).toEqual([]);
    expect(
      readTenantFixtures({ eval_fixtures: { x: 42 } }, "x"),
    ).toEqual([]);
  });

  it("returns empty when eval_fixtures is itself an array (mistyped)", () => {
    expect(
      readTenantFixtures({ eval_fixtures: [] }, "x"),
    ).toEqual([]);
  });

  it("returns valid fixtures with id + description + payload", () => {
    const settings = {
      eval_fixtures: {
        x: [
          {
            id: "f1",
            description: "first one",
            payload: { question: "what?" },
          },
          { id: "f2", payload: { question: "yo?" } },
        ],
      },
    };
    expect(readTenantFixtures(settings, "x")).toEqual([
      { id: "f1", description: "first one", payload: { question: "what?" } },
      { id: "f2", description: undefined, payload: { question: "yo?" } },
    ]);
  });

  it("drops items missing id / payload / wrong type", () => {
    const settings = {
      eval_fixtures: {
        x: [
          { id: "good", payload: { ok: true } },
          { payload: { ok: true } }, // no id
          { id: "no-payload" }, // no payload
          "string-not-object",
          null,
          { id: "", payload: { ok: true } }, // empty id
          { id: 42, payload: { ok: true } }, // non-string id
        ],
      },
    };
    const out = readTenantFixtures(settings, "x");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("good");
  });

  it("dedupes by id — first wins", () => {
    const settings = {
      eval_fixtures: {
        x: [
          { id: "dup", payload: { v: "first" } },
          { id: "dup", payload: { v: "second" } },
          { id: "unique", payload: {} },
        ],
      },
    };
    const out = readTenantFixtures(settings, "x");
    expect(out.map((f) => f.id)).toEqual(["dup", "unique"]);
    expect((out[0].payload as { v: string }).v).toBe("first");
  });

  it("preserves null payloads (predicate decides if valid)", () => {
    const settings = {
      eval_fixtures: { x: [{ id: "f", payload: null }] },
    };
    const out = readTenantFixtures(settings, "x");
    expect(out).toHaveLength(1);
    expect(out[0].payload).toBeNull();
  });
});

describe("validateTenantFixtures", () => {
  const fixtures: TenantFixture[] = [
    { id: "good-1", payload: { question: "ok" } },
    { id: "bad-shape", payload: { foo: "bar" } },
    { id: "good-2", payload: { question: "yo" } },
  ];

  const validator = (payload: unknown): true | string => {
    if (
      payload &&
      typeof payload === "object" &&
      "question" in (payload as object)
    ) {
      return true;
    }
    return "missing 'question' field";
  };

  it("separates valid + invalid by predicate", () => {
    const result = validateTenantFixtures(fixtures, validator);
    expect(result.valid.map((f) => f.id)).toEqual(["good-1", "good-2"]);
    expect(result.invalid).toEqual([
      { id: "bad-shape", reason: "missing 'question' field" },
    ]);
  });

  it("empty input returns empty + empty", () => {
    expect(validateTenantFixtures([], validator)).toEqual({
      valid: [],
      invalid: [],
    });
  });

  it("predicate returning true keeps the fixture", () => {
    const result = validateTenantFixtures(
      [{ id: "x", payload: 42 }],
      () => true,
    );
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toEqual([]);
  });

  it("predicate returning string adds rejection reason", () => {
    const result = validateTenantFixtures(
      [{ id: "x", payload: 42 }],
      () => "not allowed",
    );
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([{ id: "x", reason: "not allowed" }]);
  });
});

describe("composeFixtures", () => {
  interface Static {
    id: string;
    label: string;
  }

  it("returns static-only when tenant fixtures empty", () => {
    const out = composeFixtures<Static, { name: string }>({
      staticFixtures: [
        { id: "s1", label: "static 1" },
        { id: "s2", label: "static 2" },
      ],
      tenantFixtures: [],
      buildTenantFixture: (t) => ({ id: t.id, label: t.payload.name }),
    });
    expect(out.map((f) => f.id)).toEqual(["s1", "s2"]);
  });

  it("appends tenant fixtures with 'tenant:' id prefix", () => {
    const out = composeFixtures<Static, { name: string }>({
      staticFixtures: [{ id: "s1", label: "static 1" }],
      tenantFixtures: [{ id: "t1", payload: { name: "from tenant" } }],
      buildTenantFixture: (t) => ({ id: t.id, label: t.payload.name }),
    });
    expect(out.map((f) => f.id)).toEqual(["s1", "tenant:t1"]);
    expect(out[1].label).toBe("from tenant");
  });

  it("static fixtures come first in the output (stable baseline)", () => {
    const out = composeFixtures<Static, { name: string }>({
      staticFixtures: [{ id: "s1", label: "S" }, { id: "s2", label: "S" }],
      tenantFixtures: [
        { id: "t1", payload: { name: "T1" } },
        { id: "t2", payload: { name: "T2" } },
      ],
      buildTenantFixture: (t) => ({ id: t.id, label: t.payload.name }),
    });
    expect(out.map((f) => f.id)).toEqual([
      "s1",
      "s2",
      "tenant:t1",
      "tenant:t2",
    ]);
  });

  it("buildTenantFixture id is overwritten by the tenant: prefix", () => {
    // Even if buildTenantFixture returns a different id, the
    // composeFixtures helper enforces the tenant: prefix.
    const out = composeFixtures<Static, { name: string }>({
      staticFixtures: [],
      tenantFixtures: [{ id: "expected", payload: { name: "T" } }],
      buildTenantFixture: () => ({ id: "wrong-id", label: "T" }),
    });
    expect(out[0].id).toBe("tenant:expected");
  });

  it("does not mutate the input static fixtures array", () => {
    const staticFixtures: Static[] = [{ id: "s1", label: "S" }];
    const before = [...staticFixtures];
    composeFixtures<Static, { name: string }>({
      staticFixtures,
      tenantFixtures: [{ id: "t", payload: { name: "T" } }],
      buildTenantFixture: (t) => ({ id: t.id, label: t.payload.name }),
    });
    expect(staticFixtures).toEqual(before);
  });
});
