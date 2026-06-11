/**
 * Resolve the DISPLAY name of an activity's actor, for nominative timelines.
 *
 * Only USER-attributed actions get a name. System actions and inbound-from-
 * contact rows return null (the timeline keeps its system / prospect line), and
 * an unresolved id — a legacy null actor, or a member with no row — also returns
 * null so the line falls back to anonymous and never blanks or crashes.
 * See _specs/collision-awareness requirements R1.1/R1.5/R1.6/R1.7.
 */
export function resolveActorName(
  actorType: string | null | undefined,
  actorId: string | null | undefined,
  names: ReadonlyMap<string, string>,
): string | null {
  if (actorType !== "user" || !actorId) return null;
  return names.get(actorId) ?? null;
}
