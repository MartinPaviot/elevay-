# Hydration Audit — méthode, rubrique, inventaire ordonné

_Démarré 2026-06-24. Auteur: harness. Statut: en cours (page par page, dans l'ordre)._

## Ce que "hydration" veut dire ICI (sur preuve, pas sur intuition)

Dans ce codebase, "hydration" est **déjà** un concept maison de **chargement de
données**, PAS le sens React SSR/CSR (hydration mismatch). Preuve :
`src/app/api/home/hydrate/route.ts:12-26` — un fan-out serveur qui charge les 6
sections de la home (onboarding, dashboard summary, actions, insights,
priorities, recommendations) en un round-trip, **chaque section retombant sur
`null` ("unloaded") si son handler échoue** (`route.ts:98-117`).

Donc l'audit = pour **chaque élément de chaque page**, répondre : est-il
fidèlement rempli de **vraie donnée tenant-scopée**, avec les états
loading/empty/error gérés — ou bloqué sur null / vide / placeholder / mock /
statique / cassé ?

Ce n'est PAS un audit de hydration-mismatch SSR. (Confirmé par grep : aucun mock
pervasif dans l'app ; le seul fichier avec mock/dummy/sample est
`src/app/(marketing)/_components/real-surfaces.tsx`, une surface démo marketing.)

## Rubrique — état d'hydratation par élément (H0–H5)

| État | Nom | Définition |
|------|-----|------------|
| **H0** | Statique | Copie/label en dur, aucune source de donnée. OK pour le chrome ; défaut si l'élément DEVRAIT être dynamique. |
| **H1** | Fidèle ✅ | Câblé à de la vraie donnée tenant-scopée, avec loading + empty + dégradation d'erreur. **La cible.** |
| **H2** | Partiel | Vraie donnée mais il manque un état (loading, empty, ou error). Ou affiche du stale silencieux. |
| **H3** | Placeholder/Mock | Donnée en dur / sample / fake, ou stub "coming soon". |
| **H4** | Non câblé | L'élément existe en UI mais ne reçoit jamais de donnée (skeleton permanent, 0/—, rien). |
| **H5** | Cassé | La source 500 / shape incohérente / fuite tenant. |

Axes notés par élément : **source** (file:line) · **tenant-scoped** (oui/non) ·
**loading** (skeleton/spinner/aucun) · **empty** (géré/vide/aucun) · **error**
(indépendant/global/throw/silencieux) · **freshness** (poll/once/static/realtime).

Étalon de référence = la **Home** (`01-home.md`) : ~tous les éléments H1.

## Méthode par page (répétée pour chacune)

1. Lire `page.tsx` + suivre les imports vers les composants enfants porteurs de donnée.
2. Tracer chaque élément → sa source (route API / server action / prop / statique), file:line.
3. Classer H0–H5 + remplir les axes.
4. Lister les pires défauts concrets (file:line).
5. Écrire `_reports/hydration-audit/NN-slug.md`.

Puis (une fois l'audit complet) : **spec Kiro** par page/élément à corriger →
build → verify, **dans l'ordre de la colonne vertébrale**.

## Inventaire ordonné (~93 page.tsx)

### Tier 1 — Colonne vertébrale produit (surface quotidienne) — AUDIT EN PRIORITÉ
| # | Page | Route | Entrée |
|---|------|-------|--------|
| 01 | Home / Up next | `/` | `(dashboard)/home/page.tsx` ✅ audité |
| 02 | Chat | `/chat` | `(dashboard)/chat/page.tsx` |
| 03 | Inbox | `/inbox` | `(dashboard)/inbox/page.tsx` |
| 04 | Accounts (liste) | `/accounts` | `(dashboard)/accounts/page.tsx` |
| 05 | Account (détail) | `/accounts/[id]` | `(dashboard)/accounts/[id]/page.tsx` |
| 06 | Account brain | `/accounts/[id]/brain` | `(dashboard)/accounts/[id]/brain/page.tsx` |
| 07 | Contacts (liste) | `/contacts` | `(dashboard)/contacts/page.tsx` |
| 08 | Contact (détail) | `/contacts/[id]` | `(dashboard)/contacts/[id]/page.tsx` |
| 09 | Contacts merge | `/contacts/merge` | `(dashboard)/contacts/merge/page.tsx` |
| 10 | Opportunities (liste) | `/opportunities` | `(dashboard)/opportunities/page.tsx` |
| 11 | Opportunity (détail) | `/opportunities/[id]` | `(dashboard)/opportunities/[id]/page.tsx` |
| 12 | Sequences (liste) | `/sequences` | `(dashboard)/sequences/page.tsx` |
| 13 | Sequence (détail) | `/sequences/[id]` | `(dashboard)/sequences/[id]/page.tsx` |
| 14 | Sequence review | `/sequences/[id]/review`, `/sequences/review` | `(dashboard)/sequences/[id]/review/page.tsx`, `(dashboard)/sequences/review/page.tsx` |
| 15 | Proposals | `/proposals` | `(dashboard)/proposals/page.tsx` |
| 16 | Meetings (liste) | `/meetings` | `(dashboard)/meetings/page.tsx` |
| 17 | Meeting (détail) | `/meetings/[id]` | `(dashboard)/meetings/[id]/page.tsx` |
| 18 | Meeting upload | `/meetings/upload` | `(dashboard)/meetings/upload/page.tsx` |
| 19 | Tasks | `/tasks` | `(dashboard)/tasks/page.tsx` |
| 20 | Call mode | `/call-mode` | `(dashboard)/call-mode/page.tsx` |
| 21 | Outbound mode | `/outbound-mode` | `(dashboard)/outbound-mode/page.tsx` |
| 22 | Deliverability | `/deliverability` | `(dashboard)/deliverability/page.tsx` |
| 23 | Reports | `/reports` | `(dashboard)/reports/page.tsx` |
| 24 | Insights | `/insights` | `(dashboard)/insights/page.tsx` |
| 25 | Insights — hot-to-call | `/insights/hot-to-call` | `(dashboard)/insights/hot-to-call/page.tsx` |
| 26 | Insights — pilae | `/insights/pilae` | `(dashboard)/insights/pilae/page.tsx` |
| 27 | Insights — playbook | `/insights/playbook` | `(dashboard)/insights/playbook/page.tsx` |
| 28 | Knowledge | `/knowledge` | `(dashboard)/knowledge/page.tsx` |
| 29 | Skills | `/skills` | `(dashboard)/skills/page.tsx` |
| 30 | Notes | `/notes` | `(dashboard)/notes/page.tsx` |
| 31 | Graph | `/graph` | `(dashboard)/graph/page.tsx` |
| 32 | Voice of customer | `/voice-of-customer` | `(dashboard)/voice-of-customer/page.tsx` |
| 33 | CS today | `/cs/today` | `(dashboard)/cs/today/page.tsx` |
| 34 | Objects | `/objects/[type]` | `(dashboard)/objects/[type]/page.tsx` |
| 35 | TAM review | `/tam/review` | `(dashboard)/tam/review/page.tsx` |
| 36 | Pricing | `/pricing` | `(dashboard)/pricing/page.tsx` |

### Tier 2 — Settings (~37 pages) — APRÈS le Tier 1
workspace · members · icp · icp-profiles · signals · stages · plays · objects ·
data-model · workflows · agent · agent-memory · autonomy · guardrails ·
notifications · billing · security · privacy · product · knowledge · evals ·
llm-evals · llm-budget · mcp · mailboxes · mailbox-identity · mail-calendar ·
writing-style · inbox-voice · inbox-ai-profile · inbox-autonomy · inbox-memory ·
inbox-notifications · recording · sending-infrastructure · capture-approvals ·
docs · docs/[slug] · settings (index)

### Tier 3 — Périphérie (auth / marketing / legal) — EN DERNIER
sign-in · sign-up · forgot-password · reset-password · verify-email ·
verify-email-sent · accept-invite · landing · (marketing) home · marketing docs ·
legal (terms, privacy, security, acceptable-use, sub-processors) · test-page

## Sortie

- Un fichier par page : `NN-slug.md` (même format que `01-home.md`).
- Un rollup maître : `_rollup.md` (table une-ligne-par-page, état global + pires défauts).
