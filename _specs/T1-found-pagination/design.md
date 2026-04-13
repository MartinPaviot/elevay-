# T1-F1 — Server-side pagination hook — Design

## System fit

Nouveaux fichiers :
- `src/lib/api/paginated-response.ts` — types + query builder + runtime
  guard `isPaginatedResponse`.
- `src/hooks/use-paginated-list.ts` — React hook.

Pas de dépendance externe. `URLSearchParams` est standard browser +
Node 18+.

## Data model

Pas de DB. Shape canonique :

```ts
interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}
```

## API contracts

### Server

Tout endpoint list devrait :
- Accepter les query params `page`, `pageSize`, `sort`, `dir`, plus ceux de filtre.
- Retourner `PaginatedResponse<T>`.

Migration progressive : pas de gate forcé. Un endpoint peut continuer
à retourner `T[]` bruts tant qu'il n'a pas été migré ; le hook rejettera
alors la réponse avec `error = "Malformed paginated response"`.

### Client

```ts
const list = usePaginatedList<Account>({
  endpoint: "/api/accounts",
  pageSize: 25,
  initialSort: { field: "score", dir: "desc" },
  initialFilters: { industry: ["SaaS"] },
});

list.items        // Account[]
list.pagination   // { page, pageSize, total, hasMore }
list.loading      // boolean
list.error        // unknown | null
list.setPage(2)
list.setSort("name", "asc")
list.setFilter("tags", ["priority"])
list.clearFilter("industry")
list.refresh()
```

## Data flow

```
mount / deps change → fetchPage()
  reqId = ++latest
  setLoading(true); setError(null)
  qs = buildListQuery({ page, pageSize, sort, filters })
  fetch(endpoint + qs)
  if reqId !== latest → drop (stale)
  if !res.ok → setError(HTTP X)
  body = await res.json()
  if !isPaginatedResponse(body) → setError("malformed")
  else → setItems(transform?(body.items) ?? body.items); setPagination(body.pagination)
  finally → setLoading(false) if still latest
```

## Failure handling

- HTTP non-2xx → `error` est `Error("HTTP NNN")`.
- Network reject → `error` = raw reason.
- Malformed body → `error` = explicit Error.
- Stale race conditions → drop via request-id ref.

Les callers affichent leur propre EmptyState (variant=error) en lisant `error`.

## Security

- Aucun secret client-side.
- Le hook ne fait pas de validation d'auth ; elle est l'affaire de l'endpoint.

## Testability

`buildListQuery` et `isPaginatedResponse` sont purs et testés dans
`src/__tests__/paginated-response.test.ts` (14 cases). Le hook lui-même
n'est pas testé faute de DOM environment ; sera ajouté quand jsdom
sera introduit.

## Reversibility

Pure addition. Les pages existantes ne sont pas migrées ici.
Rollback = retirer les fichiers, pas de schéma DB touché.
