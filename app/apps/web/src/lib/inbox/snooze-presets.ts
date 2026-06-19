/**
 * Snooze presets (B6.4) — the fixed "snooze until" times offered by the pane's
 * snooze popover and the `s` keyboard shortcut. Pure with an injectable clock so
 * they unit-test without mocking Date; each lands at 09:00 local on its target
 * day. These mirror the pane's inline SNOOZE_OPTIONS so the `s` key and the
 * popover's first option resolve to the SAME instant.
 */

/** Tomorrow at 09:00 local (the pane's first snooze option + the `s` key). */
export function tomorrowMorning(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Three days out at 09:00 local. */
export function inThreeDays(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 3);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** The next Monday at 09:00 local (always strictly in the future). */
export function nextMonday(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  return d;
}
