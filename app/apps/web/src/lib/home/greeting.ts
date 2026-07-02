/**
 * One greeting, one set of thresholds, computed CLIENT-SIDE.
 *
 * History: /home rendered the dashboard-summary route's server-computed
 * greeting — on Vercel that's UTC, so Swiss users got "Good morning" at
 * 13:00. /chat computed locally but with a different evening threshold
 * (18 vs the server's 17), so the two surfaces disagreed at 17:00.
 * Both now call this with the browser's local hour.
 */
export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
