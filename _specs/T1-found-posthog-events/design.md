# T1-F10 — PostHog typed events — Design

## System fit

Étend `src/lib/analytics.ts` :
- `EventCatalog` interface maps each event name → its property shape.
- `posthogEvents` object with one helper per event, delegating to the
  existing `captureEvent` forwarder.
- `KNOWN_EVENT_NAMES` exported for tests and external consumers.

Backward-compat :
- `AnalyticsEvent` union reste (legacy call sites).
- `captureEvent(distinctId, event, properties)` reste ; sa signature
  accepte désormais `KnownEventName` en plus de l'ancien union.

## Data model

Pas de DB. Event catalog JSON-shaped :

```
EventCatalog {
  <event_name>: <properties shape>;
  ...
}
```

55 events couvrant 12 étapes :
- Landing (3)
- Auth (8)
- Onboarding (6)
- Home (2)
- Chat (5)
- Accounts (7)
- Contacts (4)
- Sequences (5)
- Meetings (4)
- Opportunities (5)
- Settings (4)
- Errors/UX (7)

## API

```ts
posthogEvents.<eventName>(distinctId: string, properties: <Shape>): Promise<void>
```

## Data flow

```
posthogEvents.X(id, props)
  → captureEvent(id, "X", props)
  → if POSTHOG_KEY absent → no-op
  → fetch POST /capture body = { api_key, event, distinct_id, properties: { ...props, $lib }, timestamp }
  → on reject → logger.warn + swallow
```

## Failure handling

- `logger.warn("analytics: captureEvent failed", { event, err })` sur
  throw fetch.
- Jamais re-throw.

## Security

- `NEXT_PUBLIC_POSTHOG_KEY` exposé côté client (normal — c'est une clé
  publique ingest-only).
- `properties` envoyées sont choisies par le caller ; pas de sanitisation
  automatique. Don't send PII that PostHog ingestion policy forbids —
  responsabilité des callers.

## Reversibility

Pure extension. Rollback = retirer le nouveau code sans casser les
callers (union `AnalyticsEvent` et `captureEvent` inchangés).
