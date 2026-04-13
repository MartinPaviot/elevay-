# T1-F1 — Server-side pagination hook — Requirements

## User story

Comme dev front-end travaillant sur une liste (accounts 10k+, contacts 50k+,
deals, activities, tasks, sequences, meetings), je veux un hook qui :
- appelle l'endpoint `GET /api/<resource>?page=&pageSize=&sort=&dir=&<filter>=`
- parse une réponse typée `{ items, pagination: { page, pageSize, total, hasMore } }`
- expose `setPage`, `setSort`, `setFilter`, `refresh`
- gère loading + error states
- garantit pas de stale responses en mode changer-vite
pour cesser de re-écrire les mêmes `useEffect + useState + query builder`
à chaque page.

## Acceptance criteria (GIVEN/WHEN/THEN)

- GIVEN options `{ endpoint: "/api/accounts", pageSize: 25 }`, WHEN mount,
  THEN `GET /api/accounts?page=1&pageSize=25` est appelé.
- GIVEN `setPage(3)`, WHEN state updates, THEN `page=3&pageSize=25` est
  reflété dans la query suivante.
- GIVEN `setFilter("industry", ["SaaS", "FinTech"])`, WHEN state updates,
  THEN la query contient `industry=SaaS&industry=FinTech` (répétée).
- GIVEN `setFilter("industry", null)`, WHEN rendu, THEN la query
  n'inclut pas `industry=`.
- GIVEN 2 fetchs en flight (le 2e suite à un `setFilter` rapide), WHEN
  le 1er résout en dernier, THEN ses résultats sont ignorés (grâce au
  request-id ref). Pas de flicker de stale data.
- GIVEN `autoFetch=false`, WHEN mount, THEN pas de fetch initial ;
  `refresh()` doit être appelé explicitement.
- GIVEN body malformé (pas `{items,pagination}`), WHEN parsed, THEN
  `error` est peuplé sans crash.

## Edge cases

- `page=0` ou négatif : clampé à ≥ 1.
- Array filter value empty `[]` : émis comme absence (pas de clé).
- `fetch` throw (network down) : `error` peuplé, pas de stale data.
- `endpoint` contient déjà un query string (ex: `?tenantId=X`) : le
  helper utilise `&` au lieu de `?`.

## Evaluation (how to test manually)

1. Une fois migrée, `/accounts` doit afficher page 1 instantanément.
2. Clic sur "Next" → page 2 load, URL du réseau contient `page=2`.
3. Tri par score desc → `sort=score&dir=desc`.
4. Typage rapide dans un filter search → pas de stale replacements.
5. DevTools offline → error state rendu.

## Decisions taken

- **URL state vs state-only** : state-only dans le hook. La persistance
  URL est laissée au caller (certains pages la veulent, d'autres pas).
  Reversibility: facile, la signature accepte initialSort/Filters.
- **Cursor vs offset** : offset (page+pageSize). Les volumes restent
  sub-200k ; offset est plus simple à implémenter côté Drizzle et
  trivialement URL-serialisable. Cursor pourra venir en v2 via un
  paramètre optionnel `cursor` sans casser l'API.
- **Array serialisation** : répéter la clé (`industry=A&industry=B`)
  plutôt que CSV (`industry=A,B`). `URLSearchParams.getAll("industry")`
  côté serveur donne directement l'array.
