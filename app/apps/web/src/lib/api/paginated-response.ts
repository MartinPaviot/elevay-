/**
 * Canonical shape for every paginated list endpoint.
 *
 * Convention:
 *   GET /api/<resource>?page=1&pageSize=25&sort=<field>&dir=asc|desc&<filterKey>=<value>
 *
 * Response body:
 *   { items: T[], pagination: { page, pageSize, total, hasMore } }
 *
 * Endpoints that don't conform yet can be migrated progressively.
 * Keeping the shape narrow (no cursor, no nextCursor) because server-side
 * offset pagination is sufficient for the list sizes we deal with today
 * and trivially serialises into URL state.
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export function isPaginatedResponse(
  value: unknown
): value is PaginatedResponse<unknown> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.items)) return false;
  const p = v.pagination as Record<string, unknown> | undefined;
  return (
    !!p &&
    typeof p.page === "number" &&
    typeof p.pageSize === "number" &&
    typeof p.total === "number" &&
    typeof p.hasMore === "boolean"
  );
}

export const DEFAULT_PAGE_SIZE = 25;

export interface BuildListQueryInput {
  page?: number;
  pageSize?: number;
  sort?: { field: string; dir: "asc" | "desc" } | null;
  filters?: Record<string, string | number | boolean | string[] | null | undefined>;
}

/**
 * Build the URL query string for a paginated list endpoint. Pure function —
 * no side-effects, no URL normalisation beyond `URLSearchParams` semantics.
 *
 * Rules:
 * - `page` defaults to 1, `pageSize` to `DEFAULT_PAGE_SIZE`.
 * - `sort` null/undefined → no sort params emitted.
 * - Filter array values are serialised as repeated keys:
 *   `?industry=SaaS&industry=FinTech`. Consumers that need CSV can join.
 * - Null/undefined filter values are dropped (so clearing a filter yields
 *   a clean URL).
 * - Empty strings are kept — they're a deliberate caller choice (e.g. a
 *   search input that was cleared).
 */
export function buildListQuery(input: BuildListQueryInput = {}): string {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  if (input.sort) {
    params.set("sort", input.sort.field);
    params.set("dir", input.sort.dir);
  }

  if (input.filters) {
    for (const [key, value] of Object.entries(input.filters)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, String(v));
      } else {
        params.set(key, String(value));
      }
    }
  }

  return params.toString();
}
