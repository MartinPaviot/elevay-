/**
 * ProviderAdapter port (spec 01, AC1). The single typed boundary every provider
 * implements so the core never imports a vendor SDK or a vendor field name. The
 * existing domain port `CompanyEnrichmentProvider` (company-enrichment/types.ts)
 * keeps working; new adapters implement this generic port and the registry
 * registers them through it. Shapes anchor on spec 00's canonical fragments and
 * the existing neutral `EnrichedCompany`.
 */
import type { GeoRegion, ProviderContext } from "./company-enrichment/types";

/** What an adapter can do + how results come back. */
export interface ProviderCapabilities {
  /** Operations this adapter supports, e.g. "company.search", "company.enrich",
   *  "contact.search", "email.verify". Open vocabulary. */
  operations: string[];
  /** True when results return ASYNCHRONOUSLY via a webhook (AC4) rather than
   *  inline in the call. Async adapters MUST implement registerWebhook +
   *  reconcile. */
  async: boolean;
  /** Regions where this provider is strongest (routing hint). */
  geoAffinity?: GeoRegion[];
}

/** A cost model, not a flat scalar — lets the metering layer (spec 02) price a
 *  call before making it. */
export interface CostModel {
  /** Estimated US cents per call. */
  perCallCents: number;
  /** Optional additional cents per record returned (search/list endpoints). */
  perRecordCents?: number;
  /** True for flat-subscription providers (perCallCents is then amortized/0). */
  flatSubscription?: boolean;
}

/** Field-level confidence in [0,1]. */
export type Confidence = number;

/** A provider rate limiter the ADAPTER owns (AC5). The core never manages
 *  provider limits — it just calls acquire() before a request and feeds back
 *  any 429 Retry-After. */
export interface RateLimiter {
  /** Resolve when the caller may proceed (paces calls to the provider quota). */
  acquire(): Promise<void>;
  /** Honor a provider 429: pause new acquisitions for retryAfterMs. */
  onRateLimit(retryAfterMs: number): void;
}

/** Typed provider error; the limiter backs off on 429/5xx (AC4 design). */
export class ProviderError extends Error {
  readonly provider: string;
  readonly status?: number;
  readonly retryAfterMs?: number;
  constructor(provider: string, message: string, opts?: { status?: number; retryAfterMs?: number }) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.status = opts?.status;
    this.retryAfterMs = opts?.retryAfterMs;
  }
  get isRetryable(): boolean {
    return this.status === 429 || (this.status !== undefined && this.status >= 500);
  }
}

/** Returned by an async adapter's registerWebhook (AC4). */
export interface WebhookRegistration {
  /** The callback URL the provider should POST results to. */
  url: string;
  /** Opaque correlation id echoed back so reconcile can match the result. */
  correlationId: string;
}

export interface RegisterWebhookCtx {
  /** App base URL (e.g. https://elevay.dev) the provider can reach. */
  baseUrl: string;
  /** Caller-supplied correlation id (e.g. contactId) for matching. */
  correlationId: string;
}

/**
 * The generic adapter port. `TIn` is the core's neutral request (e.g. an ICP
 * query or an EnrichInput); `TOut` is the core's neutral result (e.g. a
 * CanonicalAccount fragment). `TProviderReq`/`TProviderRes` are the vendor
 * shapes — they exist ONLY between toProviderRequest and fromProviderResponse
 * and never escape the adapter.
 */
export interface ProviderAdapter<TIn, TOut, TProviderReq = unknown, TProviderRes = unknown> {
  /** Short slug, e.g. "apollo". */
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  readonly costModel: CostModel;
  /** The adapter's OWN rate limiter (AC5). */
  readonly limiter: RateLimiter;
  /** False when config (env keys) is missing so the core skips it silently. */
  isAvailable(): boolean;
  /** Map the neutral request to the vendor request. Pure. */
  toProviderRequest(input: TIn): TProviderReq;
  /** Map the vendor response to the neutral result. Pure. No vendor type
   *  escapes past this boundary (AC3). */
  fromProviderResponse(res: TProviderRes): TOut;
  /** Per-field confidence in the normalized output [0,1]. */
  confidenceFor(field: keyof TOut & string, out: TOut): Confidence;
  /** Async capability (AC4) — present iff capabilities.async. Returns the
   *  callback URL the provider posts to. */
  registerWebhook?(ctx: RegisterWebhookCtx): WebhookRegistration;
  /** Async capability (AC4) — map an inbound webhook payload to the neutral
   *  result (or null if it doesn't match / isn't ready). */
  reconcile?(payload: unknown, ctx: ProviderContext): Promise<TOut | null>;
}
