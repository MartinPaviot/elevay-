# Hydration Audit — rollup Tier 3 (auth/marketing/legal, 15 pages)

_Généré 2026-06-24._

## Distribution

| État | Pages |
|------|-------|
| H1 (fidèle) | 8 |
| H0 (statique) | 7 |

## Pages

| # | Page | Route | État | Verdict |
|---|------|-------|------|---------|
| T01 | sign-in | `/sign-in` | **H1** | Action-driven credentials + OAuth sign-in page. It correctly reads real state: auth() is awaited on mount to redirect already-authenticated users (I4), and contextual banners (registered, reason, erro |
| T02 | sign-up | `/sign-up` | **H1** | Server component (async) that loads real state on render: it awaits auth() for the session (redirects authed users), validateInviteToken() (real DB lookup with hashed token, status/expiry check), and  |
| T03 | forgot-password | `/forgot-password` | **H1** | Action-driven password-reset form. On mount it loads no tenant/server state (correct for an auth page) and renders a static email-entry form. On submit it POSTs the typed email to /api/auth/forgot-pas |
| T04 | reset-password | `/reset-password` | **H1** | Client-side, action-driven password reset form. Reads the reset token from the URL query string (useSearchParams) and POSTs {token, password} to /api/auth/reset-password, then redirects to sign-in on  |
| T05 | verify-email | `/verify-email` | **H1** | Pure server-component verification flow that faithfully reflects real verification state. It reads the emailed token from searchParams, hashes + validates it against the email_verification_tokens tabl |
| T06 | verify-email-sent | `/verify-email-sent` | **H1** | Post-signup "Check your inbox" page. Server component reads the real session via auth(); redirects signed-out users to /sign-in; renders the actual signed-in email address; derives webmail deep-link b |
| T07 | accept-invite | `/accept-invite` | **H1** | Action-driven invite-acceptance page that faithfully loads and renders real state. On mount it fetches GET /api/auth/invite/[token], which validates the SHA-256-hashed token against pending invites an |
| T08 | landing | `/landing` | **H1** | /landing is a 5-line server component that does nothing but redirect("/") to the root. It renders no UI and bears no data. There is no hydration surface to assess — it is a routing shim, not a page. L |
| T09 | marketing-home | `/(marketing)` | **H0** | The public marketing landing page. A "use client" component (page.tsx) composed entirely of static marketing copy: hero, integrations/trust strip, how-it-works, human-in-the-loop, founder quote, compe |
| T10 | marketing-docs | `/docs` | **H0** | The /docs index page is a static marketing/educational surface ("The Method" — Elevay's founder-led sales playbook). All data-bearing elements (phase groups, step titles/descriptions, read-time estima |
| T11 | legal-terms | `/terms` | **H0** | The /terms page is a fully static server component rendering hardcoded Terms of Service legal copy. It imports only Next.js Metadata type, fetches no data, references no tenant/user state, and has no  |
| T12 | legal-privacy | `/privacy` | **H0** | Static legal page rendering the Privacy Policy. The only data-bearing elements are the "Last updated" date and the sub-processors table, both sourced from a static build-time JSON import (@/data/dpas. |
| T13 | legal-security | `/security` | **H0** | Static security/compliance documentation page. The entry file is a single default-exported server component rendering hardcoded prose (architecture, encryption, access control, compliance roadmap, vul |
| T14 | legal-acceptable-use | `/acceptable-use` | **H0** | Acceptable Use Policy legal page. A single default-exported server component rendering hardcoded legal copy. No imports beyond Next's Metadata type, no child components, no data fetching, no API route |
| T15 | legal-sub-processors | `/sub-processors` | **H0** | Legal sub-processors disclosure page. Server component that imports a checked-in static JSON file (src/data/dpas.json) at build time and renders it as a table (provider, purpose, data residency, opera |

## Défauts réels (hors statique-par-design)

_Aucun — la périphérie est statique-par-design (légal/marketing) ou action-driven (auth) = H0/H1 corrects._