import { describe, it, expect } from "vitest";
import { routeTools, getToolGroup } from "../tool-router";
import { getSpecialistTools } from "@/lib/agents/orchestrator";

/**
 * getKnowledge must be reachable from ANY phrasing — it is the
 * deliberate-selection half of the chat's knowledge awareness (the
 * Knowledge Index in the system prompt names entries; this tool fetches
 * them). Query group = always included.
 */

const STUB = {
  queryContacts: {},
  getKnowledge: {},
  draftEmail: {},
} as Record<string, unknown>;

describe("getKnowledge routing", () => {
  it("is in the query group", () => {
    expect(getToolGroup("getKnowledge")).toBe("query");
  });

  it("is always available regardless of intent", () => {
    for (const msg of [
      "comment je gère l'objection prix ?",
      "create a deal",
      "draft an email to Anna",
      "qui est Pilae ?",
    ]) {
      expect("getKnowledge" in routeTools(STUB, msg), `present for: ${msg}`).toBe(true);
    }
  });

  it("every specialist keeps getKnowledge", () => {
    for (const s of ["research", "outreach", "deal", "data", "admin"] as const) {
      expect("getKnowledge" in getSpecialistTools([s], STUB), `specialist: ${s}`).toBe(true);
    }
  });
});
