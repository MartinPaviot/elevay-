# 01 — Home / Up next (`/`) — audit d'hydratation

**Verdict global : H1 (fidèle).** Page-étalon. La home est surtout du chrome ;
toute la donnée vit dans `<UpNextView/>` (lit `/api/home/up-next`) + 4 widgets
satellites, tous câblés à de la vraie donnée tenant-scopée, avec
loading/empty/dégradation indépendante. Aucun défaut bloquant. 2 défauts mineurs.

Entrée : `src/app/(dashboard)/home/page.tsx` (`"use client"`).

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|
| `PageHeader` titre "Up next" | `home/page.tsx:196` | statique | H0 | n/a | n/a | n/a | n/a | static |
| `PageHeader` sous-titre `today` | `home/page.tsx:52-57,196` | `Date` après mount | H2 | n/a | aucun | n/a | n/a | once |
| `VisitorIdCapBanner` | `home/page.tsx:200` | `/api/dashboard/visitor-id-spend` (`visitor-id-cap-banner.tsx:56`) | H1 | oui | aucun (null) | self-hide | silencieux (`:60-62`) | once |
| `HotInboundsWidget` | `home/page.tsx:208` | `/api/dashboard/hot-inbounds` (`hot-inbounds-widget.tsx:53`) | H1 | oui | skeleton (`:86-107`) | self-hide (`:109`) | →`[]` (`:57`) | once |
| `HotVisitorsWidget` | `home/page.tsx:209` | `/api/dashboard/hot-visitors` (`hot-visitors-widget.tsx:60`) | H1 | oui | skeleton (`:75-96`) | self-hide (`:98`) | →`[]` (`:64`) | once |
| `WarmLeadPrompt` | `home/page.tsx:214` | flag `onboarding.v2.warm-lead-prompt` (`:44`) | H1 | oui (flags) | n/a | flag-gated | n/a | once |
| `ScalingPathPrompt` | `home/page.tsx:215-221` | URL param `scalingPath` (`:68-71`) | H1 | n/a | n/a | param-gated | n/a | once |
| `TAMRevealNotification` | `home/page.tsx:222` | URL param `firstTime` (`:60-67`) | H1 | n/a | n/a | param-gated | n/a | once |
| `UpNextView` — greeting | `up-next-view.tsx:157,164` | `/api/home/up-next` → `summary.greeting/firstName` (`up-next/route.ts:66-67`) | H1 | oui | spinner (`:149`) | "Welcome" fallback | keep-last-good (`:101`) | poll 30s |
| `UpNextView` — KPI strip | `up-next-view.tsx:169-195` | `buildKpis(metrics)` ← `founderMetrics` (`route.ts:40-49`) | H1 | oui | spinner | `kpis ?? []` | →0 par metric | poll 30s |
| `UpNextView` — Activity (actualités) | `up-next-view.tsx:200-234` | `loadActualites()` events DB réels (`route.ts:159-453`) | H1 | oui (`eq(tenantId)`) | spinner | EmptyLine (`:232`) | try/catch→`[]` (`:450`) | poll 30s |
| `UpNextView` — Needs you (todos) | `up-next-view.tsx:237-277` | `buildNeedsYou()` ← replies+risk+meetings+tasks (`route.ts:63`) | H1 | oui | spinner | EmptyLine (`:275`) | lanes dégradent indép. | poll 30s |
| `EmailComposerPanel` (reply) | `up-next-view.tsx:280` | draft local depuis le todo (`:112-118`) | H1 | n/a | n/a | n/a | n/a | n/a |
| `OnboardingV2Wrapper` | `home/page.tsx:235-249` | `/api/home/hydrate` → `onboarding` (`:93-104`) | H1 | oui | n/a | fallback `/api/onboarding/status` (`:98`) | catch→fallback | once |

## Pires défauts (mineurs)

1. **Loading granularité — `UpNextView`** (`up-next-view.tsx:149-155`) : un seul
   spinner centré pour TOUT le briefing (greeting + 6 KPIs + 2 colonnes). Pas de
   skeleton qui calque la forme finale → flash de layout au chargement. Les
   widgets satellites font mieux (skeleton réaliste). **Fix proposé** : skeleton
   KPI-strip + 2-colonnes pendant `loading`.
2. **Sous-titre `today` vide au premier paint** (`home/page.tsx:52-57`) : `today`
   démarre `""` puis se remplit en `useEffect` (choix délibéré pour éviter un
   mismatch SSR tz/locale). Flash d'un sous-titre vide ~1 frame. **Fix proposé** :
   rendre la date côté serveur en UTC fixe, ou un skeleton de sous-titre.

## Ce qui est exemplaire (à répliquer ailleurs)

- Chaque lane/​widget **dégrade indépendamment** vers vide — une section lente ou
  cassée ne brique jamais la page (`up-next/route.ts:29`, `hydrate/route.ts:18-20`).
- Empty states **rédigés** ("Nothing new yet — activity from across Elevay shows
  up here.", `up-next-view.tsx:232`), pas un blanc.
- Tenant-scoping systématique (`eq(activities.tenantId, tenantId)` partout dans
  `loadActualites`).
- Self-hide quand vide pour les widgets speed-to-lead (pas de padding mort).
