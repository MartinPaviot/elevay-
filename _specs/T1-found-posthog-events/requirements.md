# T1-F10 — PostHog typed events — Requirements

## User story

Comme dev travaillant sur n'importe quelle étape du funnel, je veux
appeler PostHog avec autocomplete sur le nom de l'event ET sur le shape
des propriétés, pour cesser de typo-ter les event names et pour que
l'ajout d'une nouvelle étape soit une modification unique dans un seul
fichier.

## Acceptance criteria (GIVEN/WHEN/THEN)

- GIVEN `posthogEvents.signup_completed("u1", { method: "google", userId: "u1" })`,
  WHEN compilé, THEN aucune erreur TS.
- GIVEN `posthogEvents.signup_completed("u1", { method: "wrong" })`,
  WHEN compilé, THEN erreur TS (type `method` restreint).
- GIVEN `NEXT_PUBLIC_POSTHOG_KEY` absent, WHEN n'importe quel helper
  appelé, THEN pas de fetch, pas d'erreur.
- GIVEN `NEXT_PUBLIC_POSTHOG_KEY` set + fetch OK, WHEN helper appelé,
  THEN 1 POST à `<POSTHOG_HOST>/capture/` avec `event: <name>`,
  `distinct_id`, `properties` + `$lib: "elevay-server"`.
- GIVEN fetch reject (network), WHEN helper appelé, THEN promise resolves
  sans throw ; warn loggé via `logger.warn`.
- GIVEN legacy `captureEvent("u1", "signup", { method: "credentials" })`,
  WHEN invoqué, THEN même comportement qu'avant T1-F10.

## Edge cases

- Ajout d'un nouvel event : modifier `EventCatalog` + `buildHelpers.names`
  array. Les tests vérifient que la liste expose bien les events clés
  du funnel (autres contributions ne cassent pas le test).
- Props avec valeur optionnelle (`?:`) : supportées.
- Props `Record<string, never>` (ex: offline_detected) : passés sans props.

## Evaluation

1. Grep existantes usages `captureEvent("signup", ...)` : compilent toujours.
2. `import { posthogEvents } from "@/lib/analytics"` dans une page → autocomplete liste tous les events.
3. Taper `posthogEvents.` → 55 events affichés dans IntelliSense.

## Decisions taken

- **Tree-shakeable ?** Non — un seul object `posthogEvents` exporté.
  Acceptable : bundler traite l'object comme "used" si un seul helper
  est appelé, mais les bundles actuels tolèrent ce pattern sans
  explosion (~3KB gzip pour 55 helpers + catalog).
- **Server vs client SDK** : forwarde vers `captureEvent` (fetch HTTP
  serveur-side friendly). Client-side PostHog JS SDK n'est pas
  rebranché ici — fait partie de F10 v2.
- **Silent catch** : transformé en `logger.warn` avec contexte. Plus de
  BUGFIX-06 regression.
