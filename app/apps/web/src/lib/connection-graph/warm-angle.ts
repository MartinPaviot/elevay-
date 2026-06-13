/**
 * Warm-path → outreach angle (_specs/CONNECTION-GRAPH).
 *
 * Turns a warm path into GUIDANCE for the sequence/call generator — never
 * final copy (the generator writes the message, fail-closed). Mirrors the
 * `common_investor` warm-path angle pattern: a warm path changes the
 * message from cold to referred.
 *
 *  - insider     → "first_degree": founder-to-founder, you already know
 *                  someone there.
 *  - intro_path  → "shared_connection": reference the mutual / ask for an
 *                  intro through a named connector.
 *
 * Self-contained (does not touch the shared methodology library) so the
 * connection-graph feature stays cohesive and independent. Pure.
 */

import type { WarmConnector, WarmPath } from "./types";

export type WarmAngleType = "first_degree" | "shared_connection";

export interface WarmAngle {
  type: WarmAngleType;
  /** Instruction to the generator — what to lean on, not the copy itself. */
  openerHint: string;
  /** Named people the founder can actually leverage (may be empty when the
   * plan only exposed a count). */
  connectors: WarmConnector[];
}

function firstNames(connectors: WarmConnector[], limit = 2): string {
  const names = connectors.slice(0, limit).map((c) => c.personName);
  if (names.length === 0) return "";
  if (connectors.length > limit) return `${names.join(", ")} (+${connectors.length - limit})`;
  return names.join(", ");
}

export function warmPathToAngle(
  warmPath: WarmPath | null | undefined,
  company?: { name?: string | null } | null,
): WarmAngle | null {
  if (!warmPath || warmPath.kind === "none") return null;
  const where = company?.name ? ` at ${company.name}` : "";

  if (warmPath.kind === "insider") {
    const who = firstNames(warmPath.connectors);
    return {
      type: "first_degree",
      openerHint: who
        ? `You're directly connected to ${who}${where}. Open founder-to-founder — you already share a network, so this is a trusted reach-out, not a cold pitch.`
        : `You have a direct connection${where}. Open as a peer who already shares their network, not as a cold vendor.`,
      connectors: warmPath.connectors,
    };
  }

  // intro_path
  const who = firstNames(warmPath.connectors);
  return {
    type: "shared_connection",
    openerHint: who
      ? `You share connection(s) with this person — ${who}. Reference the mutual connection or ask them for a warm intro; do not open cold.`
      : `You share connections with this person. Reference the mutual connection as the reason for reaching out; do not open cold.`,
    connectors: warmPath.connectors,
  };
}
