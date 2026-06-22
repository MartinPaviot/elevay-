/**
 * employees -> range bucket (spec 01, AC2). The canonical home for the
 * employee-count ladder that was duplicated inline across api/tam/route.ts and
 * inngest/campaign-functions.ts (RECONCILE.md). Pure.
 */
export type EmployeeRange =
  | "1-10" | "11-20" | "21-50" | "51-100" | "101-200" | "201-500"
  | "501-1,000" | "1,001-2,000" | "2,001-5,000" | "5,001-10,000" | "10,001+";

/** Map a raw employee count to a canonical range bucket. Null/0 -> null. */
export function employeesToRange(count: number | null | undefined): EmployeeRange | null {
  if (!count || count < 1) return null;
  if (count <= 10) return "1-10";
  if (count <= 20) return "11-20";
  if (count <= 50) return "21-50";
  if (count <= 100) return "51-100";
  if (count <= 200) return "101-200";
  if (count <= 500) return "201-500";
  if (count <= 1000) return "501-1,000";
  if (count <= 2000) return "1,001-2,000";
  if (count <= 5000) return "2,001-5,000";
  if (count <= 10000) return "5,001-10,000";
  return "10,001+";
}
