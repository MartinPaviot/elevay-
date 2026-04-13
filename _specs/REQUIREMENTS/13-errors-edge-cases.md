# Étape 13 — Erreurs & Edge Cases — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** transversal — error boundaries, session expiration, rate limiting, empty states, silent failures, logging, observability.
**Méthode :** audit-deep `01-landing-admin-errors.md` zone 3 + reports post BUGFIX-06 + code current.

---

## 0. État actuel — rappel + updates

### 0.1 BUGFIX-06 accomplishments (verify via commits `1dd48b0`, `cca9482`, `7d933aa`, `f875be7`)
- Silent `.catch(() => {})` purgés dans :
  - `app/(dashboard)/**` ✅
  - `components/**` ✅
  - `app/api/**` ✅
  - `inngest/**` ✅
  - `lib/**` ✅
- Pattern adopté : `safeFetch` + `useSafeFetch` hook (pilot 3 pages puis extension).
- Toasts + console.warn pour tous les catches client.
- Logging structuré pour tous les catches async côté backend.

### 0.2 Résidus à vérifier/corriger
- **Silent catch chat `approveCard`** (détecté en étape 6 §0.5) — ligne 458-459. À nettoyer en commit follow-up.
- **Session expiration zombie** (audit-01 §3.11) : Google + Microsoft refresh tokens auto, mais si refresh fail → pas de redirect user, UI peut se bloquer.
- **Pas de Sentry / Datadog / observability centralized error tracker.**
- **`apps/admin` sans middleware auth** — dépend reverse proxy.
- **Error boundaries Next.js basiques** : `global-error.tsx` et `(dashboard)/error.tsx` minimaux.

### 0.3 Patterns d'erreur actuels
**Server-side (sain) :**
```ts
} catch (error) {
  console.error("Purge failed:", error);
  return Response.json({ error: "Purge failed" }, { status: 500 });
}
```

**Client-side (standard après BUGFIX-06) :**
```ts
try { ... }
catch (err) {
  toast.error(err instanceof Error ? err.message : "Failed");
  console.warn("context: action failed", err);
}
```

**Async/Inngest :**
```ts
.catch((err) => logger.warn("Failed to trigger", { err, context }))
```

---

## 1. Exigences pixel-level

### 1.1 Error boundaries améliorés
- **Actuel :** `global-error.tsx` 47 lignes, `(dashboard)/error.tsx` 45 lignes, minimalistes.
- **Exigences :**
  - Per-route error boundaries (`app/(dashboard)/accounts/error.tsx`, etc.) pour isoler les crashes et garder le reste du dashboard utilisable.
  - Afficher `error.digest` (opaque ID) pour support : "Error ID: e_abc123 — share with support".
  - "Report this error" button → envoie vers support OR opens Sentry feedback widget.
  - "Try again" (existing) + "Go home" + "Contact support".
  - Design : illustration (pas stock) + copy empathique ("Something didn't load. We've been notified.").
  - **Not "Something went wrong"** — specify when possible ("Couldn't load your accounts. Your data is safe, just a display hiccup.").

### 1.2 Session expiration UX
- **Exigences critiques :**
  - Si refresh token fail (Google/Microsoft revoked) → redirect to `/sign-in?reason=session-expired&callbackUrl=<current>`.
  - Sign-in page affiche banner "Your session expired. Please sign in again." (dépend I1 étape 3).
  - **Before** expiration : if `token.expiresAt - now < 5min`, background refresh. If refresh fail, toast "Your Google connection needs refresh — [Reconnect](#settings/mail-calendar)".
  - **Warm-up re-prompt** : si user inactif > 30min et nombre de tabs ouverts > 1, pas de hard-redirect — soft-prompt.
  - **Multi-tab logout sync** : BroadcastChannel pour propager logout à toutes les tabs.

### 1.3 Rate limiting UX
- Actuel : IP-based 200 req/min globally, 10 req/min sur `/api/auth/*` (middleware.ts).
- Exigences :
  - Per-user + per-IP (pas seulement IP).
  - Per-tenant quotas (prévenir abus d'un tenant qui flood).
  - **429 responses avec `Retry-After` header** + UI toast informatif "You've hit a temporary limit. Try again in 30 seconds.".
  - **Soft-limits UI** : avant d'atteindre le cap, warn "You're approaching your monthly limit — [Upgrade](/settings/billing)" (80 % usage).
  - **Hard-limits UI** : bloque l'action avec CTA upgrade.

### 1.4 Empty states (comprehensive)
Deep-dive nécessaire sur chaque page. Patterns :
- **First-use** : "Your accounts appear here — [Start by importing CSV] [Find first leads]".
- **No results from filter** : "No deals match 'stage=won AND value>100k'. [Clear filters]".
- **Feature not yet used** : "You haven't created any sequences yet. [Create your first] [Use template]".
- **Error state** : différencier visuellement — rouge subtle + retry + support contact.
- **Loading state** : toujours skeleton match exact de ce qui remplacera.
- **No permission** : "This section is admin-only. [Contact your admin]".

### 1.5 Observability
- **Sentry (ou équivalent) intégration :**
  - Client + server errors captured.
  - Source maps uploaded.
  - Breadcrumbs : user actions, fetch calls, state changes.
  - Release tags sync with git SHA.
  - Performance monitoring (web vitals).
- **Logger centralized :**
  - `lib/logger.ts` existe ✅. Étendre usage.
  - Log levels : debug | info | warn | error.
  - Structured JSON in prod, pretty in dev.
  - Metadata per log : tenant_id, user_id, request_id.
- **Alerts :**
  - Sentry alert rules : error rate spike, new error, slow transaction.
  - PagerDuty / OpsGenie si SLA enterprise.

### 1.6 Network connectivity
- Detect offline state (`navigator.onLine` + fetch timeouts).
- Global banner "You appear to be offline. Reconnecting…" (top sticky).
- Queue mutations locally (IndexedDB) and retry when back online.
- Read-only mode fallback : utilisateur peut encore voir cached data.

### 1.7 Optimistic updates + rollback
- Pour toutes mutations (stage change, inline edit, delete) : optimistic update + rollback si server rejects.
- Toast "Saved" vert 2s / Toast rouge "Failed to save — [Retry]" avec retry button + undo.

### 1.8 Form validation errors
- **Inline** sous le champ (pas banner global) — cohérent avec sign-up §1.8.
- **aria-invalid + aria-describedby** pour A11y.
- **Focus auto** sur 1er champ invalid au submit.
- **Debounced validation** on blur (check format email, URL validity, etc.).

### 1.9 LLM errors + retry
- Si LLM call fails (timeout, rate limit, bad JSON) :
  - Retry 1× with backoff + temp=0.1.
  - Log fail dans `_reports/llm-failures.md` (règles Rippletide).
  - User fallback : "AI is taking longer than usual. [Retry] [Use manual mode]".
- **Partial streaming errors** : if stream cuts mid-response, show "Response truncated. [Retry]".

### 1.10 Inngest job failures
- Dead letter queue → stored in DB.
- `/settings/system/failed-jobs` admin page : list, retry, skip.
- Alert email to admin if dead-letter accumulates > 10 in 1h.

### 1.11 Database connection errors
- Middleware catches DB unreachable → render fallback page "We're having trouble connecting. We're working on it." + status page link.
- Graceful degradation : if cache (Redis) is up even if DB is slow, serve from cache.

### 1.12 Third-party API failures
- **Apollo down** : enrich/TAM features show "Enrichment temporarily unavailable. [Retry]" + queue the request for retry.
- **Resend down** : sequences paused + admin banner "Email sending paused due to provider issue. We'll auto-resume.".
- **Recall.ai down** : bot scheduling skipped + log, meeting still captured manually upload.
- **Stripe down** : billing page shows cached data + "Live billing unavailable".

### 1.13 Content security
- **XSS prevention** : all AI-generated content rendered via sanitize-html before display.
- **URL validation** : all user-input URLs sanitized (no javascript:).
- **Email content** : Markdown rendering limits (no iframe, no scripts, no onX handlers).

### 1.14 Destructive action confirms
- **Patterns :**
  - Simple delete : 2-click confirm button "Click to delete" → "Confirm deletion".
  - Medium destructive : dialog "Are you sure?" + detail of impact.
  - Heavy destructive (delete tenant, delete all data) : typed confirmation "DELETE [NAME]".
  - **Undo toast 10s** pour les deletes simples (accounts, contacts, deals).
  - **Permanent bit** : "This cannot be undone." in bold for irreversible actions.

### 1.15 Duplicate prevention
- **Create account/contact/deal** : server-side check dupes via email/domain/name+company.
- UI : inline "[Name] already exists — [Use existing] / [Create anyway]".
- Client-side debounced check before submit.

### 1.16 Concurrency / optimistic locking
- **Problem :** 2 users editing the same deal simultaneously → last-write-wins.
- **Exigence :** `updatedAt` version check on PUT. If mismatch → 409 Conflict + UI prompts "This record was updated by another user. [Reload] / [Force overwrite]".

### 1.17 Analytics PostHog
- `error_rendered` (error_digest, route, component)
- `session_expired` (duration_since_last_activity)
- `rate_limit_hit` (endpoint, user_id)
- `offline_detected` (duration_s)
- `llm_failure` (model, reason, retry_count)
- `inngest_job_failed` (function_name, error)

### 1.18 Status page
- Public `https://status.elevay.com` (StatusPage.io / BetterStack).
- Subsystems : API / Web / Email sending / Meeting bots / LLM / Database.
- Subscribe for incidents (email + RSS).
- Historical uptime 90-day view.
- Embed widget in app footer ("All systems operational ●").

### 1.19 A11y globally
- **Focus indicators** visible on all interactive elements (`:focus-visible`).
- **Skip to content** link.
- **Semantic HTML** : landmarks (nav/main/aside/footer).
- **aria-live regions** for toasts / notifications.
- **Keyboard traps** avoidance in modals.
- **Contrast ratio** ≥ 4.5:1 (WCAG AA).
- **Test with screen reader** (NVDA / VoiceOver).

### 1.20 Printable / export
- Emails / meeting notes / deals : "Print" / "PDF export" options.
- Print stylesheet clean (no nav, no sidebar, print-optimized typography).

---

## 2. Comparaison concurrents

Impossible à comparer frame-by-frame sur erreurs sans captures dédiées. Patterns inférés :
- Monaco : probablement Sentry (standard SaaS), dark theme error pages.
- Lightfield : probablement Datadog, status page publique (à vérifier).

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) |
|---|---|---|---|
| E1 | Sentry integration (client + server + breadcrumbs + source maps) | **CRITIQUE** | 8 |
| E2 | Session expiration UX (redirect + refresh fail banner + multi-tab sync) | **CRITIQUE** | 6 |
| E3 | Per-route error boundaries Next.js | **CRITIQUE** | 4 |
| E4 | Chat approveCard silent catch fix (follow-up BUGFIX-06) | **CRITIQUE** | 1 |
| E5 | Destructive action confirms (typed, undo toast 10s) | **CRITIQUE** | 6 |
| E6 | Duplicate prevention client + server (account/contact/deal) | HAUTE | 6 |
| E7 | Optimistic locking 409 handling | HAUTE | 5 |
| E8 | Rate limit 429 + Retry-After header + toast UI | HAUTE | 4 |
| E9 | Offline detection + queue mutations | HAUTE | 10 |
| E10 | LLM errors retry + fallback + log `_reports/llm-failures.md` | HAUTE | 5 |
| E11 | Form validation inline + aria + focus-auto | HAUTE | 6 |
| E12 | Inngest dead-letter admin page + alerts | HAUTE | 6 |
| E13 | Third-party API graceful degradation (Apollo/Resend/Recall/Stripe) | HAUTE | 10 |
| E14 | Content security sanitize HTML + URL validation | HAUTE | 4 |
| E15 | Status page public + footer widget | HAUTE | 6 |
| E16 | Empty states audit systematic (all pages) | MOYENNE | 8 |
| E17 | Optimistic updates rollback pattern (mutations) | MOYENNE | 6 |
| E18 | Per-tenant quotas (soft-limit warnings) | MOYENNE | 6 |
| E19 | Print / PDF export emails/notes/deals | MOYENNE | 6 |
| E20 | A11y global pass (focus, contrast, screen reader test) | MOYENNE | 10 |
| E21 | Analytics PostHog (6 events) | BASSE | 2 |

**Total v1 (E1-E15) :** ~87h · **v2 :** ~38h

---

## 4. Décisions à prendre

1. **Error tracker : Sentry, Datadog, or LogRocket ?** → **Sentry** (ecosystem, affordable, strong Next.js support).
2. **Status page : BetterStack, StatusPage.io, or Instatus ?** → **BetterStack** (modern, affordable).
3. **Undo toast duration :** 5s, 10s, 15s ? → **10s** (Linear/Gmail standard).
4. **Offline queue storage :** IndexedDB or localStorage ? → **IndexedDB** (bigger capacity, structured).
5. **Typed confirmation threshold :** delete tenant only or all destructive ? → **Heavy destructive only** (delete tenant, delete all, export then delete).
6. **LLM failure logging :** `_reports/` file or DB table ? → **DB table** (queryable, timestamps, tenant-scoped).

---

## 5. Prochaines actions
1. Martin : décisions §4.
2. Sprint critique : E1+E2+E3+E4+E5 (25h) — foundation.
3. Sprint haute : E6+E7+E8+E10+E14 (23h) — data integrity.
4. Sprint : E9+E11+E12+E13+E15 (36h) — resilience + status.
5. v2 : E16-E21.
