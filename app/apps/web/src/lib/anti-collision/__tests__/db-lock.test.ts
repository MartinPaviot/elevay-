import { describe, it, expect, vi } from "vitest";
import { DbCollisionLock } from "../db-lock";

/**
 * Spec 14 — JS glue of the Postgres lock. The atomic one-winner property is a
 * SQL property (PK + ON CONFLICT ... setWhere) verified live against the DB;
 * here we pin the return-value mapping: a RETURNING row -> held; none -> lost.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stubDb(opts: { returningRows?: any[]; selectRows?: any[] } = {}) {
  const deleteWhere = vi.fn(async () => {});
  const db = {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: async () => opts.returningRows ?? [],
        }),
      }),
    }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => opts.selectRows ?? [] }) }) }),
    delete: () => ({ where: deleteWhere }),
    _deleteWhere: deleteWhere,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return db;
}

describe("DbCollisionLock", () => {
  it("acquire -> true when the upsert RETURNs a row (free / reclaimed / same holder)", async () => {
    const lock = new DbCollisionLock("t1", stubDb({ returningRows: [{ enrollmentId: "e1" }] }));
    expect(await lock.acquire("c1", "e1", 1000)).toBe(true);
  });

  it("acquire -> false when the upsert RETURNs nothing (held by another, not expired)", async () => {
    const lock = new DbCollisionLock("t1", stubDb({ returningRows: [] }));
    expect(await lock.acquire("c1", "e2", 1000)).toBe(false);
  });

  it("holder -> the live enrollment id, or null", async () => {
    expect(await new DbCollisionLock("t1", stubDb({ selectRows: [{ e: "e1" }] })).holder("c1")).toBe("e1");
    expect(await new DbCollisionLock("t1", stubDb({ selectRows: [] })).holder("c1")).toBeNull();
  });

  it("release issues a delete (unfenced and fenced both delete; the fenced WHERE adds enrollment_id — SQL verified live)", async () => {
    const db = stubDb();
    const lock = new DbCollisionLock("t1", db);
    await lock.release("c1"); // unconditional: WHERE contact_id = c1
    await lock.release("c1", "e1"); // fenced: WHERE contact_id = c1 AND enrollment_id = e1
    expect(db._deleteWhere).toHaveBeenCalledTimes(2);
    // The two predicates are distinct objects (the fenced one is the compound and()).
    expect(db._deleteWhere.mock.calls[0][0]).not.toBe(db._deleteWhere.mock.calls[1][0]);
  });
});
