/**
 * Apollo company-search reference adapter (spec 01, AC3/AC4/AC5). Implements the
 * generic ProviderAdapter end to end for Apollo's company search: it maps a
 * neutral CompanySearchQuery to Apollo's request and Apollo's response to the
 * neutral EnrichedCompany, using the shared normalizers. Apollo's vendor types
 * are imported as `type` only and never escape past fromProviderResponse (the
 * forensic `raw` field is explicitly Record<string,unknown>). The adapter owns
 * its rate limiter (AC5) and declares an async capability with registerWebhook +
 * reconcile for Apollo's webhook-delivered enrichment (AC4).
 *
 * Pure mapping: this file makes NO live Apollo call — the orchestrator runs
 * toProviderRequest -> fetch -> fromProviderResponse. CI tests it against a
 * recorded fixture.
 */
import type { OrgSearchParams, OrgSearchOrganization } from "@/lib/integrations/apollo-client";
import type { EnrichedCompany, ProviderContext } from "../company-enrichment/types";
import type {
  ProviderAdapter,
  ProviderCapabilities,
  CostModel,
  Confidence,
  RateLimiter,
  RegisterWebhookCtx,
  WebhookRegistration,
} from "../port";
import { TokenBucketLimiter } from "../rate-limit";
import { countryToIso, techToSlug, employeesToRange } from "../normalizers";

/** Neutral company-search query (TIn). The core speaks this, never Apollo's. */
export interface CompanySearchQuery {
  name?: string;
  keywords?: string[];
  employees?: { min?: number; max?: number };
  /** Free-form or ISO country/location strings. */
  locations?: string[];
  /** Technology slugs. */
  technologies?: string[];
  revenue?: { min?: number; max?: number };
  domains?: string[];
  page?: number;
  perPage?: number;
}

/** Minimal shape of Apollo's async enrichment webhook payload (for reconcile). */
interface ApolloWebhookPayload {
  organization?: Partial<OrgSearchOrganization>;
}

function domainFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function toEnriched(org: OrgSearchOrganization): EnrichedCompany {
  return {
    domain: org.primary_domain ?? domainFromUrl(org.website_url),
    name: org.name ?? null,
    industry: org.industry ?? null,
    description: org.description ?? null,
    employeeCount: org.estimated_num_employees ?? null,
    sizeRange: employeesToRange(org.estimated_num_employees),
    annualRevenue: org.annual_revenue ?? null,
    revenueRange: null,
    foundedYear: org.founded_year ?? null,
    city: org.city ?? null,
    state: org.state ?? null,
    country: countryToIso(org.country),
    technologies: (org.technology_names ?? []).map((t) => techToSlug(t)).filter((s): s is string => !!s),
    keywords: org.keywords ?? [],
    fundingStage: org.latest_funding_stage ?? null,
    totalFunding: org.total_funding ?? null,
    linkedinUrl: org.linkedin_url ?? null,
    logoUrl: org.logo_url ?? null,
    investors: org.investor_names ?? [],
    raw: org as unknown as Record<string, unknown>,
  };
}

const CAPABILITIES: ProviderCapabilities = {
  operations: ["company.search", "company.enrich"],
  // Apollo delivers waterfall enrichment (e.g. phone reveal) asynchronously via
  // a webhook, so the adapter declares an async capability (AC4).
  async: true,
};

const COST_MODEL: CostModel = {
  // Apollo is a flat-subscription product; per-call cost is amortized.
  perCallCents: 0,
  perRecordCents: 0,
  flatSubscription: true,
};

export class ApolloCompanySearchAdapter
  implements ProviderAdapter<CompanySearchQuery, EnrichedCompany, OrgSearchParams, OrgSearchOrganization>
{
  readonly name = "apollo";
  readonly capabilities = CAPABILITIES;
  readonly costModel = COST_MODEL;
  // Apollo's documented limit is generous; pace at ~200 req/min with a small
  // burst. The adapter OWNS this — the core never paces it (AC5).
  readonly limiter: RateLimiter = new TokenBucketLimiter({
    tokensPerInterval: 200,
    intervalMs: 60_000,
    burst: 20,
  });

  isAvailable(): boolean {
    return !!process.env.APOLLO_API_KEY;
  }

  toProviderRequest(input: CompanySearchQuery): OrgSearchParams {
    const params: OrgSearchParams = {};
    if (input.name) params.q_organization_name = input.name;
    if (input.keywords?.length) params.q_organization_keyword_tags = input.keywords;
    if (input.employees && (input.employees.min != null || input.employees.max != null)) {
      const min = input.employees.min ?? 1;
      const max = input.employees.max ?? 1_000_000;
      params.organization_num_employees_ranges = [`${min},${max}`];
    }
    if (input.locations?.length) params.organization_locations = input.locations;
    if (input.technologies?.length) params.currently_using_any_of_technology_uids = input.technologies;
    if (input.revenue && (input.revenue.min != null || input.revenue.max != null)) {
      params.revenue_range = { min: input.revenue.min, max: input.revenue.max };
    }
    if (input.domains?.length) params.q_organization_domains_list = input.domains;
    if (input.page != null) params.page = input.page;
    params.per_page = input.perPage ?? 100;
    return params;
  }

  fromProviderResponse(res: OrgSearchOrganization): EnrichedCompany {
    return toEnriched(res);
  }

  confidenceFor(field: keyof EnrichedCompany & string, out: EnrichedCompany): Confidence {
    const v = out[field];
    if (v == null || (Array.isArray(v) && v.length === 0)) return 0;
    // Identity-grade fields Apollo returns directly are high-confidence; derived
    // / normalized fields are slightly lower.
    if (field === "domain" || field === "name" || field === "linkedinUrl") return 0.95;
    if (field === "country" || field === "sizeRange" || field === "technologies") return 0.7; // normalized
    return 0.85;
  }

  registerWebhook(ctx: RegisterWebhookCtx): WebhookRegistration {
    const url = new URL("/api/webhooks/apollo", ctx.baseUrl);
    url.searchParams.set("cid", ctx.correlationId);
    return { url: url.toString(), correlationId: ctx.correlationId };
  }

  async reconcile(payload: unknown, _ctx: ProviderContext): Promise<EnrichedCompany | null> {
    const p = payload as ApolloWebhookPayload | null;
    if (!p?.organization || !p.organization.id) return null;
    return toEnriched(p.organization as OrgSearchOrganization);
  }
}

export const apolloCompanySearchAdapter = new ApolloCompanySearchAdapter();
