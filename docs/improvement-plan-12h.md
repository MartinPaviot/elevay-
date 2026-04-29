# Plan d'amelioration continue — 12h

> Genere le 29 avril 2026 apres analyse concurrentielle.
> Objectif : fermer les 5 gaps qui font perdre des demos.

## Contexte

Elevay gagne sur : autonomie (9/10), speed-to-value (10/10), knowledge graph (9/10).
Elevay perd sur : email experience (6/10 vs Lightfield 9), signal freshness (batch vs real-time), org chart viz (absent vs Rox).

## Plan par cycle (2h chacun)

### Cycle 1 (H0-H2) — Side-panel email composer
**Gap** : Lightfield a un composant email side-panel avec send reel. Elevay force le copy/paste.
**Action** : Creer `EmailComposerPanel` — slide-over avec To/Cc/Subject/Body pre-rempli, bouton Send qui POST `/api/emails/send`, preview markdown, attach files.
**Verification** : Le composant s'ouvre depuis le chat (quand l'agent draft un email), depuis la page contacts, et depuis les sequences.
**Commit** : "feat: side-panel email composer with real send"

### Cycle 2 (H2-H4) — Auto-fill deal fields from conversations
**Gap** : Rox et Monaco remplissent automatiquement budget/timeline/stakeholders depuis les calls.
**Action** : Enrichir le post-call pipeline (process-transcript → deal update). Quand l'email intelligence detecte budget/timeline/authority, mettre a jour les champs du deal automatiquement (via approval mode).
**Verification** : Un meeting synce → deal.value, deal.expectedCloseDate, deal contacts mis a jour.
**Commit** : "feat: auto-fill deal fields from meeting + email intelligence"

### Cycle 3 (H4-H6) — Real-time signal monitoring
**Gap** : Les signal scans sont en batch hebdomadaire. Rox/Monaco/FuseAI font du real-time.
**Action** : Convertir le signal detection d'un cron en event-driven. Quand un email arrive, un meeting finit, ou un enrichissement Apollo retourne → evaluer les signaux immediatement. Creer des notifications en temps reel.
**Verification** : Un email entrant qui mentionne un concurrent → notification en <5 minutes (pas 1 semaine).
**Commit** : "feat: event-driven signal detection (real-time vs weekly batch)"

### Cycle 4 (H6-H8) — Org chart visualization
**Gap** : Rox construit des org charts automatiquement. Elevay a le stakeholder map mais pas la visualisation.
**Action** : Creer un composant `OrgChartViz` qui affiche les stakeholders en arborescence (CEO → VP → Dir → IC) base sur les titres et les patterns d'interaction. Utiliser le stakeholder map data + Apollo seniority.
**Verification** : Sur la page deal detail, l'org chart montre les relations hierarchiques avec les roles codes par couleur.
**Commit** : "feat: org chart visualization on deal detail"

### Cycle 5 (H8-H10) — Inline editing everywhere
**Gap** : Lightfield a des champs editables inline partout. Elevay requiert des formulaires.
**Action** : Ajouter l'edition inline (click-to-edit) sur les pages contacts detail, accounts detail, et deals detail pour les champs principaux (name, email, phone, stage, value). Utiliser le pattern existant du custom objects page.
**Verification** : Click sur un champ → input inline → Enter/blur → save → toast confirmation.
**Commit** : "feat: inline editing on contact/account/deal detail pages"

### Cycle 6 (H10-H12) — Polish + verification + tests
**Action** :
- Typecheck complet (web + admin)
- Run tous les tests
- Build prod web + admin
- Smoke test HTTP
- Ecrire des tests pour les nouveaux composants
- Mettre a jour la competency map
- Commit final avec bilan
**Commit** : "chore: polish pass + updated competency scores"

## Metriques de succes

| Metrique | Avant | Apres cible |
|----------|-------|-------------|
| Email experience score | 6/10 | 8/10 |
| Signal freshness | weekly batch | event-driven (<5min) |
| Org chart | absent | visible sur deal detail |
| Inline editing | custom objects only | contacts + accounts + deals |
| Deal auto-fill | manual | auto from calls + emails |
