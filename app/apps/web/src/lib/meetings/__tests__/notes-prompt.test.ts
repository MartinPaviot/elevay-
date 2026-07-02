import { describe, it, expect } from "vitest";
import { buildMeetingNotesPrompt } from "../notes-schema";

// The sovereign kMeet sweep runs the SAME extraction for cofounder syncs as for
// prospect calls. The sales/MEDDPICC framing would push the model to invent a
// buying group on an internal meeting — so `internal` switches to a recap
// register that steers the qualification fields empty. Same schema either way.
describe("buildMeetingNotesPrompt — internal vs sales register", () => {
  const base = {
    transcript: "We decided to keep kMeet. Paul owns the HubSpot import by Friday.",
    meetingTitle: "Cofounder sync",
    meetingDate: "2026-07-02",
  };

  it("uses the sales/MEDDPICC framing by default", () => {
    const p = buildMeetingNotesPrompt(base);
    expect(p).toContain("MEDDPICC");
    expect(p).not.toContain("INTERNAL team meeting");
    expect(p).toContain(base.transcript);
  });

  it("switches to an internal recap register when internal=true", () => {
    const p = buildMeetingNotesPrompt({ ...base, internal: true });
    expect(p).toContain("INTERNAL team meeting");
    expect(p).toContain("NOT a sales call");
    // Steers the qualification fields to stay empty for a non-prospect.
    expect(p).toMatch(/set meddic to null/i);
    expect(p).toMatch(/set the buyingSignals fields to null/i);
    expect(p).toContain(base.transcript);
  });

  it("internal=false is byte-identical to omitting internal (sales path unchanged)", () => {
    expect(buildMeetingNotesPrompt({ ...base, internal: false })).toBe(buildMeetingNotesPrompt(base));
  });
});
