# 36 — pricing (`/pricing`) — audit d'hydratation

**Verdict global : H4 (non câblé).** The /pricing page is a fully client-side static marketing page: every displayed value (tier names, prices, feature lists, CTAs, the 'Current Plan' marker) comes from a hardcoded `tiers` array with zero data fetching. A tenant-scoped subscription endpoint (/api/billing/subscription, returns the real tenant.plan via authCtx.tenantId) and plan-limits.ts both exist, yet the page never calls them. The result: the one element that should reflect tenant state — which plan the tenant is on — is unwired and wrong for any paying tenant (it always labels Free Trial as 'Current Plan' and shows active upgrade buttons for plans they may already own). Far below the Home-page bar; only the checkout action touches the backend, not the rendered data.

Entrée : `app/apps/web/src/app/(dashboard)/pricing/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Page header (title + subtitle) | app/apps/web/src/app/(dashboard)/pricing/page.tsx:91-96 | static hardcoded JSX | H0 | n/a | n/a | n/a | n/a | static | Pure chrome copy; legitimately static. |
| Tier name / price / priceNote / description | app/apps/web/src/app/(dashboard)/pricing/page.tsx:19-62,115-128 | hardcoded `tiers` array (page.tsx:19) | H3 | no | none | n/a | n/a | static | Prices ($0/$49/$99) and feature lists are hardcoded sample/marketing data, not sourced from Stripe products or plan-limits.ts (lib/billing/plan-limits.ts exists). Acceptable as marketing copy but unwired to any catalog source. |
| Feature checklist per tier | app/apps/web/src/app/(dashboard)/pricing/page.tsx:143-152 | hardcoded `tier.features` (page.tsx:28-60) | H3 | no | none | n/a | n/a | static | Hardcoded entitlement copy; not derived from lib/billing/plan-limits.ts so it can silently drift from real enforced limits. |
| CTA buttons / 'Current Plan' indicator | app/apps/web/src/app/(dashboard)/pricing/page.tsx:25,38,52,130-139 | hardcoded `tier.cta`; NO call to /api/billing/subscription (route.ts returns real tenant.plan) | H4 | no | none | none | silent | static | The element that MUST reflect tenant state (which plan is current) is unwired. 'Current Plan' is statically pinned to Free Trial; a paying Starter/Pro tenant sees the wrong current-plan marker and live upgrade buttons for tiers they already own. The data source (/api/billing/subscription, tenant-scoped via authCtx.tenantId) exists but is never fetched. |
| 'Most Popular' highlight / featured tier | app/apps/web/src/app/(dashboard)/pricing/page.tsx:40,109-113 | hardcoded `highlighted: true` on Starter | H0 | no | n/a | n/a | n/a | static | Marketing badge; static is acceptable but ideally would shift relative to current plan. |

## Pires défauts

1. Current-plan state is unwired: page never calls the existing tenant-scoped /api/billing/subscription (route.ts:36-44 returns tenant.plan); 'Current Plan' is hardcoded to the Free Trial tier (page.tsx:25,138), so a Starter/Pro tenant sees the wrong current-plan marker and upgrade CTAs for tiers they already own.
2. No loading/empty/error states for any data — the page renders the same static cards regardless of subscription fetch outcome; checkout failure is swallowed to console.warn (page.tsx:84) with no user-facing error.
3. Prices and feature lists are hardcoded (page.tsx:19-62) instead of being sourced from Stripe products or lib/billing/plan-limits.ts, so displayed entitlements can silently drift from the limits actually enforced.
