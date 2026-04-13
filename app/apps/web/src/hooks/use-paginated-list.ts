"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildListQuery,
  DEFAULT_PAGE_SIZE,
  isPaginatedResponse,
  type PaginatedResponse,
  type PaginationMeta,
} from "@/lib/api/paginated-response";

type FilterValue = string | number | boolean | string[] | null;

export interface UsePaginatedListOptions<T> {
  /** Base URL (e.g. "/api/accounts"). Query string is appended. */
  endpoint: string;
  pageSize?: number;
  initialSort?: { field: string; dir: "asc" | "desc" } | null;
  initialFilters?: Record<string, FilterValue>;
  /** Optional mapper — useful to coerce `unknown[]` items into typed T. */
  transform?: (items: unknown[]) => T[];
  /** When `false`, skip the initial fetch. Default `true`. */
  autoFetch?: boolean;
}

export interface UsePaginatedListReturn<T> {
  items: T[];
  pagination: PaginationMeta;
  loading: boolean;
  error: unknown | null;

  setPage: (p: number) => void;
  setSort: (field: string, dir: "asc" | "desc") => void;
  clearSort: () => void;
  setFilter: (key: string, value: FilterValue) => void;
  setFilters: (next: Record<string, FilterValue>) => void;
  clearFilter: (key: string) => void;
  refresh: () => void;
}

const INITIAL_META: PaginationMeta = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  hasMore: false,
};

/**
 * Fetch a paginated list endpoint with URL-state-friendly inputs.
 *
 * Not opinionated about routing: it does not itself read or write
 * `?page=`/etc. on the page URL. Pages that want URL persistence should
 * wire their `useSearchParams` to `setPage`/`setSort`/`setFilter`.
 */
export function usePaginatedList<T>(
  options: UsePaginatedListOptions<T>
): UsePaginatedListReturn<T> {
  const {
    endpoint,
    pageSize = DEFAULT_PAGE_SIZE,
    initialSort = null,
    initialFilters = {},
    transform,
    autoFetch = true,
  } = options;

  const [page, setPageState] = useState(1);
  const [sort, setSortState] = useState<{ field: string; dir: "asc" | "desc" } | null>(initialSort);
  const [filters, setFiltersState] = useState<Record<string, FilterValue>>(initialFilters);
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ ...INITIAL_META, pageSize });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  // Guards against stale responses arriving after the user has changed
  // page / sort / filter: track the latest request id and ignore any
  // response whose id doesn't match.
  const latestReqId = useRef(0);

  const fetchPage = useCallback(async () => {
    const reqId = ++latestReqId.current;
    setLoading(true);
    setError(null);
    try {
      const qs = buildListQuery({ page, pageSize, sort, filters });
      const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${qs}`;
      const res = await fetch(url);
      if (reqId !== latestReqId.current) return;
      if (!res.ok) {
        setError(new Error(`HTTP ${res.status}`));
        return;
      }
      const body = (await res.json()) as unknown;
      if (reqId !== latestReqId.current) return;
      if (!isPaginatedResponse(body)) {
        setError(new Error("Malformed paginated response"));
        return;
      }
      const paginated = body as PaginatedResponse<unknown>;
      const mapped = transform ? transform(paginated.items) : (paginated.items as T[]);
      setItems(mapped);
      setPagination(paginated.pagination);
    } catch (err) {
      if (reqId !== latestReqId.current) return;
      setError(err);
    } finally {
      if (reqId === latestReqId.current) setLoading(false);
    }
  }, [endpoint, page, pageSize, sort, filters, transform]);

  useEffect(() => {
    if (!autoFetch) return;
    void fetchPage();
  }, [autoFetch, fetchPage]);

  const setPage = useCallback((p: number) => setPageState(Math.max(1, p)), []);

  const setSort = useCallback((field: string, dir: "asc" | "desc") => {
    setSortState({ field, dir });
    setPageState(1);
  }, []);

  const clearSort = useCallback(() => {
    setSortState(null);
    setPageState(1);
  }, []);

  const setFilter = useCallback((key: string, value: FilterValue) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }));
    setPageState(1);
  }, []);

  const setFilters = useCallback((next: Record<string, FilterValue>) => {
    setFiltersState(next);
    setPageState(1);
  }, []);

  const clearFilter = useCallback((key: string) => {
    setFiltersState((prev) => {
      const { [key]: _drop, ...rest } = prev;
      void _drop;
      return rest;
    });
    setPageState(1);
  }, []);

  const refresh = useCallback(() => {
    void fetchPage();
  }, [fetchPage]);

  return {
    items,
    pagination,
    loading,
    error,
    setPage,
    setSort,
    clearSort,
    setFilter,
    setFilters,
    clearFilter,
    refresh,
  };
}
