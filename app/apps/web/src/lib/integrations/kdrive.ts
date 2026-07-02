/**
 * Infomaniak kDrive client — the sovereign meeting-recording retrieval path.
 *
 * kMeet (Infomaniak's Jitsi) records natively and deposits the file on the
 * organizer's kDrive, named after the ROOM Elevay minted at booking:
 *   "rdv-<room> on YYYY-MM-DD HH-mm.mp4"   (observed live 2026-07-02)
 * Since we generate the room name (90 bits of entropy, stored on the meeting
 * activity as metadata.roomName), the recording↔meeting correlation is EXACT —
 * no time-window heuristics, safe with any number of parallel meetings.
 *
 * v1 auth: a single Infomaniak API token (INFOMANIAK_API_TOKEN) + drive id
 * (INFOMANIAK_DRIVE_ID) from env — right for the current single-workspace
 * deployment. Multi-tenant needs per-tenant Infomaniak OAuth ("Connect
 * Infomaniak" next to Google/Microsoft) — deliberately out of v1.
 *
 * Endpoints from Infomaniak's own client (github.com/Infomaniak/mcp-server-kdrive):
 *   GET /3/drive/{driveId}/files/search?query=…
 *   GET /2/drive/{driveId}/files/{fileId}/download
 */

const IK_BASE = "https://api.infomaniak.com";

export interface KdriveFile {
  id: number | string;
  name: string;
  size: number;
}

type KdriveEnv = { INFOMANIAK_API_TOKEN?: string; INFOMANIAK_DRIVE_ID?: string };

export function kdriveConfigured(env: KdriveEnv = process.env as KdriveEnv): boolean {
  return !!(env.INFOMANIAK_API_TOKEN && env.INFOMANIAK_DRIVE_ID);
}

function headers(): { Authorization: string } {
  const token = process.env.INFOMANIAK_API_TOKEN;
  if (!token) throw new Error("INFOMANIAK_API_TOKEN not configured");
  return { Authorization: `Bearer ${token}` };
}

function driveId(): string {
  const id = process.env.INFOMANIAK_DRIVE_ID;
  if (!id) throw new Error("INFOMANIAK_DRIVE_ID not configured");
  return id;
}

/**
 * Pick the recording for a room out of a candidate list. Pure + unit-tested.
 * kMeet names recordings "<room> on <date> <time>.mp4"; multiple takes of the
 * same room sort lexicographically by that timestamp — take the LATEST.
 */
export function pickRecordingForRoom(files: KdriveFile[], roomName: string): KdriveFile | null {
  const room = roomName.toLowerCase();
  const matches = files
    .filter((f) => (f.name || "").toLowerCase().startsWith(room) && /\.(mp4|webm|mkv|m4a|mp3)$/i.test(f.name))
    .sort((a, b) => (a.name < b.name ? 1 : -1));
  return matches[0] ?? null;
}

/**
 * Find the kMeet recording for a room on the configured drive.
 *
 * kDrive's search tokenizer does NOT match our full room string (verified
 * live: query "rdv-bxm7zi" → 0 hits while the file exists), so we search on
 * the file-extension token and match the room prefix client-side.
 */
export async function findRecordingByRoom(roomName: string): Promise<KdriveFile | null> {
  const res = await fetch(
    `${IK_BASE}/3/drive/${driveId()}/files/search?query=mp4&limit=100`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`kDrive search failed: ${res.status}`);
  const body = (await res.json()) as { data?: KdriveFile[] };
  return pickRecordingForRoom(body.data ?? [], roomName);
}

/** Download a file's bytes. Callers enforce their own size ceiling first. */
export async function downloadKdriveFile(fileId: number | string): Promise<Buffer> {
  const res = await fetch(
    `${IK_BASE}/2/drive/${driveId()}/files/${fileId}/download`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`kDrive download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
