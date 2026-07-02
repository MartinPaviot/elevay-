import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T10 (outreach-autopilot) — drift guards for the reply-review lane wiring:
 * the split strip carries the trailing to_classify pseudo-tab, the
 * conversations route computes reviewCount next to noiseCount (one request
 * feeds the strip badge), and the review lane derives its correction options
 * from the canonical REPLY_CLASSIFICATIONS list (no parallel vocabulary).
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("T10 wiring guards (reply-review lane)", () => {
  it("the split strip renders the trailing to_classify pseudo-tab (the noise model)", () => {
    const src = read("app/(dashboard)/inbox/_split-strip.tsx");
    expect(src).toContain('id="to_classify"');
    // Hidden at zero, like Noise — the tab must be gated on the count.
    expect(src).toMatch(/reviewCount\s*>\s*0/);
  });

  it("the conversations route computes reviewCount (tenant-scoped pending count) in its payload", () => {
    const src = read("app/api/inbox/conversations/route.ts");
    expect(src).toContain("replyReviewQueue");
    expect(src).toMatch(/reviewCount:/);
    // Pending-only: resolved rows must never inflate the badge.
    expect(src).toMatch(/replyReviewQueue\.state,\s*"pending"/);
  });

  it("the review lane derives its options from REPLY_CLASSIFICATIONS — no hardcoded label list", () => {
    const src = read("app/(dashboard)/inbox/_review-lane.tsx");
    expect(src).toMatch(/from\s+["']@\/lib\/reply\/classifications["']/);
    expect(src).toContain("REPLY_CLASSIFICATIONS.map");
    // The canonical vocabulary must never be re-declared locally.
    expect(src).not.toMatch(/\[\s*["']interested["']/);
  });

  it("the inbox page wires the lane + the count end to end", () => {
    const src = read("app/(dashboard)/inbox/page.tsx");
    expect(src).toContain("ReviewLane");
    expect(src).toContain('activeSplit === "to_classify"');
    // The badge rides the conversations payload — no extra request.
    expect(src).toMatch(/setReviewCount\(data\.reviewCount \?\? 0\)/);
  });
});

describe("T10 wiring guards (backend — classifier + queue + correction)", () => {
  const strip = (src: string) =>
    src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");

  it("the live classifier shares the spec-26 confidence floor and the canonical vocabulary", () => {
    const src = strip(read("inngest/functions.ts"));
    expect(src).toMatch(/from\s+["']@\/lib\/reply\/classify["']/);
    expect(src).toContain("DEFAULT_MIN_CONFIDENCE");
    expect(src).toContain("z.enum(REPLY_CLASSIFICATIONS)");
    // The queue is an OVERLAY: the insert is conflict-absorbed and the
    // routing event fires regardless of confidence. Anchored on the insert
    // CALL with a generous lazy window — the 400-char version measured 429
    // on main (CRLF-sensitive at the margin) and broke the main run while
    // green on the PR ref; a guard checks structure, not a byte count.
    expect(src).toMatch(/\.insert\(replyReviewQueue\)[\s\S]{0,800}?\.onConflictDoNothing\(\)/);
  });

  it("objection is FIRST-LEVEL: canonical list + spec-26 intents + the handler branch", () => {
    expect(read("lib/reply/classifications.ts")).toContain('"objection"');
    expect(strip(read("lib/reply/classify.ts"))).toContain('"objection"');
    expect(strip(read("inngest/reply-handler.ts"))).toMatch(
      /classification === "objection" \|\| classification\.startsWith\("objection_"\)/,
    );
  });

  it("the correction API re-routes and records the founder label (M11-R3)", () => {
    const src = strip(read("app/api/inbox/review/[id]/route.ts"));
    expect(src).toContain('name: "reply/classified"');
    expect(src).toContain("recordFlywheelCandidate");
    expect(src).toContain('"user_edited"');
    expect(src).toContain('"user_approved"');
    expect(src).toContain("isReplyClassification");
  });
});
