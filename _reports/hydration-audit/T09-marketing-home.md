# T09 — marketing-home (`/(marketing)`) — audit d'hydratation

**Verdict global : H0 (statique).** The public marketing landing page. A "use client" component (page.tsx) composed entirely of static marketing copy: hero, integrations/trust strip, how-it-works, human-in-the-loop, founder quote, competitive landscape, demo CTAs (Calendly), FAQ accordion, "built on" strip, and footer. No tenant data is fetched or expected — correctly so for a public, unauthenticated marketing surface. The only "live-looking" element is HeroDemo, which renders the REAL product components (Accounts/Opportunities/Up-next) but feeds them clearly-labeled static fixtures (UP_NEXT_DEMO, ACCOUNTS_DEMO, OPPORTUNITIES_DEMO) via DemoSurface, which intercepts /api/* with canned data. This is honest: it is a self-playing product demo, not a claim of live tenant data (page copy explicitly offers a "live demo on your own data" separately). Docs nav link is gated to dev via DOCS_PAGE_ENABLED. No genuine hydration defect.

Entrée : `app/apps/web/src/app/(marketing)/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Hero copy + CTAs (headline, subhead, Book a demo → Calendly) | app/apps/web/src/app/(marketing)/page.tsx:372-391 | Static literals; Calendly external link (CALENDLY_URL) | H0 | n/a | n/a | n/a | n/a | static | Static marketing copy + outbound demo link. Correct for a public page. |
| HeroDemo self-playing product demo (Accounts/Opportunities/Up-next surfaces) | app/apps/web/src/app/(marketing)/_components/real-surfaces.tsx:16-45 | Real product components fed static demo fixtures (*_DEMO) via DemoSurface API interception; dynamic ssr:false | H0 | no | none | handled | silent | static | Renders the actual app surfaces but with clearly-labeled canned demo data, not a live tenant. Honest demo pattern — not faked-as-real product data. The product naming ('REAL surfaces') refers to reusing real components, the data is explicitly demo. No defect. |
| Integrations / built-on / trust chips | app/apps/web/src/app/(marketing)/page.tsx:393-423 | Static icon/label arrays; logo strip components | H0 | n/a | n/a | n/a | n/a | static | Static trust claims; each is backed by real product behavior (OAuth, encryption, HITL). Marketing copy. |
| Speed-to-lead stat (21×, MIT/InsideSales) | app/apps/web/src/app/(marketing)/page.tsx:434-448 | Hardcoded cited third-party statistic; client count-up animation | H0 | n/a | n/a | n/a | n/a | static | Cited external market data, not a product metric claimed to be live. Legitimate static. |
| Founder quote + early-access status | app/apps/web/src/app/(marketing)/page.tsx:485-515 | Static copy + image; pulsing dot is decorative (not a live status feed) | H0 | n/a | n/a | n/a | n/a | static | Honest founder copy; the 'live-status breath' is purely a visual pulse, not wired to real availability — and is not presented as real data. Fine. |
| Competitive landscape cards + FAQ accordion | app/apps/web/src/app/(marketing)/page.tsx:133-158,519-584 | Static arrays (faqs[], landscape cards); client-only open/close state | H0 | n/a | n/a | n/a | n/a | static | Static positioning + FAQ content. Action-driven accordion toggle only. |
| Nav / footer links (Docs gated, Privacy/Terms, Calendly) | app/apps/web/src/app/(marketing)/page.tsx:279-303,618-644 | Static links; DOCS_PAGE_ENABLED = NODE_ENV !== production | H0 | n/a | n/a | n/a | n/a | static | Docs link correctly hidden in prod via build-time constant (page-visibility.ts:16). Static navigation. |

## Pires défauts

_Aucun — statique par design ou fidèle._
