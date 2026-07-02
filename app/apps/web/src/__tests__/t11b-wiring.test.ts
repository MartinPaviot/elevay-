import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * outreach-autopilot T11b — cockpit wiring drift guards. Static assertions that
 * the /home cockpit strip stays wired to its real sources and never references
 * tables that do not exist yet.
 *
 * Guards the CODE, not the prose (the T2/T7/T8 lesson): comment lines are
 * stripped before the banned-string checks so a doc comment that NAMES the
 * future tables (to explain their absence) can't trip the ban. Anchored on
 * STRUCTURE with generous windows — never a tight char count. Kept OUT of
 * cle13-wiring.test.ts (T11b owns its own guard file).
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
/** Drop `//` and `*` / `/*` comment lines so a doc comment can't trip a ban check. */
const codeOf = (rel: string) =>
  read(rel)
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const HOME = "app/(dashboard)/home/page.tsx";
const STRIP = "components/cockpit-strip.tsx";
const READY_ROUTE = "app/api/home/ready-for-you/route.ts";
const CAP_ROUTE = "app/api/outreach/cap/route.ts";
const STATUS_ROUTE = "app/api/deliverability/status/route.ts";

describe("T11b wiring — the home page mounts the cockpit strip", () => {
  it("imports and mounts <CockpitStrip/>", () => {
    const code = codeOf(HOME);
    expect(code).toContain('from "@/components/cockpit-strip"');
    expect(code).toContain("<CockpitStrip");
  });
});

describe("T11b wiring — the strip reads the four cockpit sources", () => {
  it("the cap gauge reads /api/outreach/cap, plus status/summary/ready", () => {
    const code = codeOf(STRIP);
    expect(code).toContain("/api/outreach/cap");
    expect(code).toContain("/api/deliverability/status");
    expect(code).toContain("/api/dashboard/summary");
    expect(code).toContain("/api/home/ready-for-you");
  });

  it("the cap gauge derives reset client-side from timezone (no resetAt field)", () => {
    const code = codeOf(STRIP);
    // The route returns timezone + resetsAtLocalMidnight, NOT a resetAt instant.
    expect(code).toContain("timezone");
    expect(code).not.toContain("resetAt");
    // Quota-reached path is present (full/green + the deferred count).
    expect(code).toContain("deferredCount");
    expect(code).toContain("var(--color-success)");
  });
});

describe("T11b wiring — the ready route queries the three REAL tables only", () => {
  it("queries sequence_drafts, reply_review_queue and agent_actions", () => {
    const code = codeOf(READY_ROUTE);
    expect(code).toContain("sequenceDrafts");
    expect(code).toContain("replyReviewQueue");
    expect(code).toContain("agentActions");
  });

  it("uses the awaiting-approval shape for agent_actions (scheduled + null exec time)", () => {
    const code = codeOf(READY_ROUTE);
    // The founder-waiting shape — not grace-window auto-sends (which carry a time).
    expect(code).toMatch(/status[\s\S]{0,80}"scheduled"/);
    expect(code).toContain("isNull(agentActions.scheduledExecutionAt)");
  });

  it("selects the correct pending states", () => {
    const code = codeOf(READY_ROUTE);
    expect(code).toContain('"pending_approval"');
    expect(code).toContain('"pending"');
  });

  it("scopes the actions count to prospect-facing types (excludes internal create_task)", () => {
    const code = codeOf(READY_ROUTE);
    // The verify-finding fix: only consequential, prospect-facing types count,
    // so 940 internal create_task rows never flood "actions to approve".
    expect(code).toContain("inArray(agentActions.actionType");
    for (const t of ["send_followup", "draft_reply", "enroll_sequence", "advance_deal"]) {
      expect(code, `allowlist must include ${t}`).toContain(`"${t}"`);
    }
    // create_task must NOT be an allowlisted type (comment lines are stripped
    // by codeOf, so a doc comment naming it as excluded can't trip this).
    expect(code).not.toContain('"create_task"');
  });
});

describe("T11b wiring — future tables are NEVER referenced", () => {
  it("no cockpit file mentions linkedin_action_queue or gifting_tasks (T13/T22, non-existent)", () => {
    for (const rel of [HOME, STRIP, READY_ROUTE, CAP_ROUTE, STATUS_ROUTE]) {
      const code = codeOf(rel);
      expect(code, `${rel} must not reference linkedin_action_queue`).not.toContain("linkedin_action_queue");
      expect(code, `${rel} must not reference gifting_tasks`).not.toContain("gifting_tasks");
      expect(code, `${rel} must not reference linkedinActionQueue`).not.toContain("linkedinActionQueue");
      expect(code, `${rel} must not reference giftingTasks`).not.toContain("giftingTasks");
    }
  });
});

describe("T11b wiring — the deliverability status read exposes the guard", () => {
  it("uses evaluateGuard (the server-only guard) tenant-scoped", () => {
    const code = codeOf(STATUS_ROUTE);
    expect(code).toContain("evaluateGuard");
    expect(code).toContain("authCtx.tenantId");
    expect(code).toContain("tripped");
  });
});
