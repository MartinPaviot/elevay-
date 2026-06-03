/**
 * Zefix client — Swiss Federal Commercial Registry (ZefixPublicREST).
 *
 * IMPORTANT: Zefix searches by NAME and filters by canton/legal-form only
 * — there is NO sector (NOGA) or headcount filter. So it is NOT an ICP
 * discovery engine (it can't find "fintech 30-150 FTE in Geneva"); its
 * role is VERIFICATION / ENRICHMENT of a known Swiss company:
 *   - authoritative UID (CHE-…) for dedup (the Swiss SIREN),
 *   - the canton (geography fit) + active status,
 *   - the legal form + purpose (Zweck).
 * Swiss DISCOVERY sourcing stays Apollo / Cognism.
 *
 * Auth: HTTP Basic (free Zefix API account). Key-gated on
 * ZEFIX_API_USER + ZEFIX_API_PASSWORD.
 */

import { cantonCode } from "./swiss-cantons";

const ZEFIX_BASE = "https://www.zefix.admin.ch/ZefixPublicREST/api/v1";

export interface ZefixFirm {
  uid: string | null; // CHE-xxx.xxx.xxx
  name: string | null;
  canton: string | null; // 2-letter code
  legalForm: string | null;
  legalSeat: string | null; // municipality
  active: boolean | null;
  purpose: string | null; // Zweck (detail only)
}

export function isZefixAvailable(): boolean {
  return Boolean(process.env.ZEFIX_API_USER && process.env.ZEFIX_API_PASSWORD);
}

function authHeader(): string {
  const u = process.env.ZEFIX_API_USER ?? "";
  const p = process.env.ZEFIX_API_PASSWORD ?? "";
  return "Basic " + Buffer.from(`${u}:${p}`).toString("base64");
}

/** Normalize a raw Zefix firm record (search summary or detail) — pure. */
export function normalizeFirm(raw: Record<string, unknown>): ZefixFirm {
  const lf = raw.legalForm as { name?: unknown; shortName?: unknown } | string | undefined;
  const legalForm =
    typeof lf === "string" ? lf : (lf?.name as string) ?? (lf?.shortName as string) ?? null;
  const status = String(raw.status ?? "").toUpperCase();
  return {
    uid: (raw.uid as string) ?? null,
    name: (raw.name as string) ?? null,
    canton: (raw.canton as string) ?? null,
    legalForm,
    legalSeat: (raw.legalSeat as string) ?? null,
    active: raw.status !== undefined ? status === "ACTIVE" || status === "EXISTING" : null,
    purpose: (raw.purpose as string) ?? null,
  };
}

/** Pick the best firm for a query name — pure. Exact normalized match
 *  wins, then a contains match, then the first result. */
export function pickBestMatch(query: string, firms: ZefixFirm[]): ZefixFirm | null {
  if (firms.length === 0) return null;
  const n = (s: string | null) =>
    (s ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
  const q = n(query);
  return (
    firms.find((f) => n(f.name) === q) ??
    firms.find((f) => n(f.name).includes(q) || q.includes(n(f.name))) ??
    firms[0]
  );
}

async function zfetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${ZEFIX_BASE}${path}`, {
    ...init,
    headers: { Authorization: authHeader(), "content-type": "application/json", accept: "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Zefix ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

/** Search firms by name, optionally filtered to a canton (any-language name or code). */
export async function searchFirms(params: {
  name: string;
  canton?: string;
  activeOnly?: boolean;
  maxEntries?: number;
}): Promise<ZefixFirm[]> {
  if (!isZefixAvailable()) throw new Error("ZEFIX_API_USER/PASSWORD not set");
  const body: Record<string, unknown> = {
    name: params.name,
    languageKey: "fr",
    maxEntries: params.maxEntries ?? 30,
    offset: 0,
    activeOnly: params.activeOnly ?? true,
  };
  const code = params.canton ? cantonCode(params.canton) : null;
  if (code) body.canton = code;
  const raw = (await zfetch("/firm/search.json", { method: "POST", body: JSON.stringify(body) })) as unknown;
  const list = (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>;
  return list.map(normalizeFirm);
}

/** Full firm detail by UID (adds purpose + status). */
export async function getFirm(uid: string): Promise<ZefixFirm | null> {
  if (!isZefixAvailable()) throw new Error("ZEFIX_API_USER/PASSWORD not set");
  const raw = (await zfetch(`/firm/${encodeURIComponent(uid)}.json`)) as Record<string, unknown> | null;
  if (!raw) return null;
  // Detail may nest the firm under a key; handle flat or wrapped.
  const firm = (Array.isArray(raw) ? raw[0] : (raw as Record<string, unknown>)) as Record<string, unknown>;
  return normalizeFirm(firm);
}

/**
 * Verify/enrich a known Swiss company: search by name (+ canton hint),
 * return the best authoritative match (UID, canton, legal form, active).
 */
export async function verifySwissCompany(params: {
  name: string;
  cantonHint?: string;
}): Promise<ZefixFirm | null> {
  const firms = await searchFirms({ name: params.name, canton: params.cantonHint, activeOnly: true });
  return pickBestMatch(params.name, firms);
}
