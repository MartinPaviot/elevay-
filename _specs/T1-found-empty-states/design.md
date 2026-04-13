# T1-F7 — Empty states foundation — Design

## System fit

Dépend de : `components/ui/button` (déjà existant, toutes variantes
requises supportées : solid/outline/gradient/ghost).
Impact sur : les 10+ pages qui importent déjà `EmptyState`. **API
backward-compatible** : le nouveau prop `variant` est optionnel, la
forme legacy (icon + title + description + actionLabel/onAction) reste
un chemin valide → aucune migration forcée.

## Data model

Pas de changements DB.

## API

```tsx
<EmptyState
  variant="first-use" | "no-filter-match" | "error" | "loading" | "no-permission"
  icon={<CustomIcon />}                 // optional — overrides variant default
  title="..."
  description="..."
  actionLabel="Create account"
  onAction={() => {...}}
  actionVariant="gradient"              // primary button variant
  secondaryActionLabel="Import CSV"     // optional secondary CTA
  onSecondaryAction={() => {...}}
/>
```

Default icons par variant :
- first-use → `Inbox`
- no-filter-match → `SearchX`
- error → `AlertCircle`
- loading → `Loader2` (animation spin)
- no-permission → `Lock`

Tone map (background + foreground couleurs) :
- error → `rgba(220,38,38,0.08)` + `var(--color-error, #b91c1c)`
- other → `var(--color-bg-hover)` + `var(--color-text-tertiary|muted)`

A11y : `role=alert`+`aria-live=assertive` sur error, `role=status`
ailleurs ; `aria-live=polite` par défaut.

## Data flow

Pure rendering, pas de state.

## Failure handling

N/A.

## Security

N/A.
