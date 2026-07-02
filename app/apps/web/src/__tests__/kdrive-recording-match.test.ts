import { describe, it, expect } from "vitest";
import { pickRecordingForRoom, kdriveConfigured } from "@/lib/integrations/kdrive";

/**
 * The recording↔meeting correlation of the kMeet sweep: Elevay mints the room
 * name at booking; kMeet names the recording "<room> on YYYY-MM-DD HH-mm.mp4"
 * (observed live 2026-07-02). Matching is by room PREFIX — exact even with any
 * number of parallel meetings — never by time-window heuristics.
 */
describe("pickRecordingForRoom", () => {
  const files = [
    { id: 1, name: "holiday.mp4", size: 100 },
    { id: 2, name: "rdv-aaaa1111 on 2026-07-02 10-00.mp4", size: 200 },
    { id: 3, name: "rdv-bxm7zi27xxiudkvf9z on 2026-07-02 16-28.mp4", size: 300 },
    { id: 4, name: "rdv-bxm7zi27xxiudkvf9z on 2026-07-02 17-05.mp4", size: 400 },
    { id: 5, name: "notes.txt", size: 10 },
  ];

  it("matches the file named after the room, not other rooms or unrelated media", () => {
    const f = pickRecordingForRoom(files, "rdv-aaaa1111");
    expect(f?.id).toBe(2);
  });

  it("takes the LATEST take when the same room was recorded twice", () => {
    const f = pickRecordingForRoom(files, "rdv-bxm7zi27xxiudkvf9z");
    expect(f?.id).toBe(4);
  });

  it("is case-insensitive on the room prefix", () => {
    const f = pickRecordingForRoom(files, "RDV-AAAA1111");
    expect(f?.id).toBe(2);
  });

  it("returns null when the recording is not deposited yet", () => {
    expect(pickRecordingForRoom(files, "rdv-zzzz9999")).toBeNull();
  });

  it("ignores non-media files even when the name matches", () => {
    expect(pickRecordingForRoom([{ id: 9, name: "rdv-x notes.txt", size: 5 }], "rdv-x")).toBeNull();
  });
});

describe("kdriveConfigured", () => {
  it("requires BOTH the token and the drive id", () => {
    expect(kdriveConfigured({})).toBe(false);
    expect(kdriveConfigured({ INFOMANIAK_API_TOKEN: "x" })).toBe(false);
    expect(kdriveConfigured({ INFOMANIAK_API_TOKEN: "x", INFOMANIAK_DRIVE_ID: "1" })).toBe(true);
  });
});
