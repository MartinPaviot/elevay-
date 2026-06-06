# Audit produit Elevay — Synthèse

Date : 2026-06-05 · Périmètre : produit complet · Méthode : baseline statique (6 agents, lecture de code) + walk live sur **prod** (www.elevay.dev, workspace "E2E Test Workspace" = 767 comptes réels Pilae). Tenant Martin en lecture seule (aucune mutation).

---

## TL;DR — les 5 choses qui comptent

1. **[S0] Le LLM n'est pas configuré en prod → le chat est cassé** (`POST /api/chat` = 500). La feature centrale du produit "chat-first" ne répond pas. En cascade : ICP fit, analyse concurrentielle, smart search, reports IA, input chat du Home, personnalisation des openers — **toute la couche "intelligence" est inerte en prod**. C'est le fix #1, et c'est une **clé d'API à poser sur Vercel**, pas du dev.

2. **[S1] Le produit est un archipel relié en base, pas dans l'UI.** Sur 20 coutures testables entre features, **13 sont des culs-de-sac** et 1 seule est exemplaire. Les clés de liaison (companyId, contactId, dealId, threadId, entityId) sont stockées et souvent déjà chargées — mais **l'interface ne rend pas l'arête**. Confirmé en live : un contact enrôlé dans une séquence est du texte brut sans lien vers sa fiche ; une opportunité ne peut pas ouvrir son compte ni générer sa proposale ; une tâche ne pointe pas vers son entité.

3. **[S1] Le "dernier mètre vers l'action" manque partout.** Les surfaces de lecture (Insights, Account Brain, Deliverability, Playbook, widgets du Home) montrent de l'intelligence mais **ne passent pas la main** à la surface qui exécute (Call Mode, Campaigns, Tasks). hot-to-call n'ouvre pas le softphone ; les recos de deliverability sont du texte ; les widgets du Home n'ont pas de clic.

4. **[S1] La boucle "agir → enregistrer → étape suivante" n'est pas fermée.** Fin d'appel = aucune capture d'outcome dans l'UI ; "Confirm & update CRM" d'un meeting crée des tâches en silence sans back-link. Un moteur GTM a besoin de cette boucle ; elle est ouverte.

5. **[S1] Beaucoup de features réelles sont hors navigation** (deliverability, reports IA, les 3 sous-insights, cs/today, voice-of-customer, graph) — invisibles pour l'utilisateur. Le produit a plus de surface que la nav n'en révèle.

---

## Le récit en une phrase

Elevay a **plus de capacité que d'accès** : la donnée, les outils (≈126 côté chat), l'enrichissement et les écrans existent — mais (a) la clé LLM manque en prod, et (b) l'UI ne relie pas les morceaux. Le moteur est là ; le câblage de surface et une variable d'environnement manquent.

---

## Ce qui marche (à préserver)

- **Account Brain (S5)** : seul hub d'agrégation 360° (contacts/deals/activités/meetings/knowledge/graph/memories) — la seule couture notée 1.0. La preuve que relier les choses est faisable ici.
- **La carte d'onboarding** (`onboarding-confirmation-card.tsx`, sur /home) : single-screen "confirme ce que j'ai déduit", avec **badge de source d'inférence par champ** + live-count TAM. Exemplaire, conforme à tes principes (infer over asking). NB : le wizard `/onboarding-v3` est du **code mort** — le vrai onboarding est cette carte.
- Plusieurs **empty states** clairs et orientés-action (contacts, inbox, meetings) qui pontent vers l'étape suivante.

---

## Scorecard coutures (détail dans `seams.md`)

| | traverse 1.0 | partiel 0.5 | cul-de-sac 0.0 | non testé |
|---|---|---|---|---|
| nb | 1 (S5) | 6 | 13 | 6 |

Lecture : sur le testable, la fluidité inter-feature est **majoritairement absente**.

---

## Plan de fix priorisé (détail + preuves dans `gap-register.md`)

**Faire en premier (débloque la valeur, coût faible) :**
- **Configurer la clé LLM sur Vercel prod** → ressuscite chat + toute la couche intelligence (C1). Une variable.
- **Réparer "Upload transcript"** (→ "Meeting not found") — bug net (N18).
- **Unifier l'ICP** (settings vide vs ICP effectif qui score 767 comptes) — le user doit contrôler l'ICP réel (C7).

**Ensuite (la fluidité — le cœur de ta question) :**
- **Rendre les arêtes** : enrolled→contact, opp→account, opp→proposal, contact→deals, meeting→fiche/tasks, notes/tasks→entité, hot-to-call→call-mode. C'est répétitif et mécanique (la donnée est déjà là) → fort ROI.
- **Ajouter le "dernier mètre"** : un CTA exécutable sur chaque surface de lecture.
- **Fermer la boucle outcome** : capture post-appel/meeting → task/deal.
- **Exposer les routes orphelines** dans la nav (ou supprimer le mort, ex. /onboarding-v3).

**Polish (visible, pas bloquant) :** #418 hydration récurrent ; i18n FR/EN ; jargon dev dans les empty states ; score incohérent (F/1/0.8) ; HEALTH 0/POOR trompeur ; page dogfood Pilae exposée.

---

## Méthode (réutilisable) & couverture

- **2 niveaux** : nœuds (grille 7 états) + coutures (report de contexte) — voir `README.md`.
- **Baseline statique** : 6 agents en parallèle (lecture de code, zéro navigateur) → `code-analysis/*.md`. Sert de référence "comportement attendu".
- **Walk live** : Playwright solo sur prod, screenshot→lecture de l'image (ground truth UX) → fiche par nœud + notation des coutures. 30 screenshots dans `screenshots/`.

**Live-testé (≈21 nœuds)** : accounts (liste/fiche/brain), contacts, opportunities, proposals, inbox, call-mode, sequences (liste/détail), deliverability, home+onboarding, meetings(+upload), notes, tasks, insights(+hot-to-call/playbook/pilae), reports, cs/today, chat, knowledge, skills, ⌘K, settings/icp.

**Non live-testé (verdict statique, honnêtement signalé)** : contact/opp détail & merge (0 data), voice-of-customer, graph, guardrails/autonomy/llm-budget (gouvernance), Phase A signup (mutation + fragilité navigateur). Le vrai onboarding a néanmoins été observé en live.

**Limites** : workspace TAM-only (767 comptes, 0 contact/deal/meeting) → les coutures d'engagement profond reposent sur le statique + les empty states. Empty states = en fait l'expérience premier-run, donc utile. `/api/notifications` ERR_NAME_NOT_RESOLVED = probable hoquet DNS sandbox, non retenu.

---

## Carte des artefacts (`_audit/`)
- `SYNTHESIS.md` (ce fichier) · `seams.md` (coutures notées) · `gap-register.md` (backlog priorisé) · `CROSS-CUTTING.md` (C1–C7)
- `journey-graph.md` (nœuds + fil rouge) · `README.md` (méthode/barème)
- `nodes/*.md` (fiches live) · `code-analysis/*.md` (baseline statique) · `screenshots/*` (preuves) · `progress.txt`
