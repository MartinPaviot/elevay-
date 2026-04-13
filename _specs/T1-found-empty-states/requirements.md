# T1-F7 — Empty states foundation — Requirements

## User story

Comme dev front-end travaillant sur une liste (accounts, contacts, deals,
tasks, sequences, meetings, …), je veux un composant EmptyState réutilisable
avec 5 variantes canoniques (first-use / no-filter-match / error / loading
/ no-permission), pour cesser de re-écrire le même motif "icône +
titre + texte + CTA" à chaque page.

## Acceptance criteria (GIVEN/WHEN/THEN)

- GIVEN variant=first-use, WHEN render sans `icon` prop, THEN affiche
  l'icône `Inbox` par défaut.
- GIVEN variant=error, WHEN rendu, THEN le container a
  `role="alert"` + `aria-live="assertive"`.
- GIVEN variant=loading, WHEN rendu, THEN `role="status"` +
  `aria-live="polite"` + icône animée.
- GIVEN `actionLabel`+`onAction`, WHEN rendu, THEN Primary CTA cliquable.
- GIVEN `secondaryActionLabel`+`onSecondaryAction`, WHEN rendu, THEN
  secondary CTA (variant=outline) à côté du primary.
- GIVEN callers legacy sans `variant`, WHEN rendu, THEN comportement
  identique à l'ancien composant (variant="first-use" par défaut, icône
  fournie par le caller).

## Edge cases

- Aucun CTA fourni : pas de block CTA rendu.
- Custom `icon` override : remplace l'icône par défaut de la variant.
- Variant inconnue : non possible (TypeScript union).

## Evaluation (how to test manually)

1. Changer l'import sur `/accounts/page.tsx` pour passer
   `variant="first-use"` : aspect identique.
2. Sur `/contacts/page.tsx` si aucun contact → `variant="first-use"` :
   affichage attendu.
3. Sur `/reports/page.tsx` simuler une 500 → `variant="error"` : alert
   accessible lu par screen reader.

## Test debt

Pas de DOM environment configuré dans le projet (vitest `environment=node`).
Ajouter jsdom + @testing-library/react en T1-F8 ou T1-F1 pour unblock les
composant/hook tests ; T1-F7 livre sans component tests, avec typecheck
vert et un manuel smoke-test sur 2 pages.
