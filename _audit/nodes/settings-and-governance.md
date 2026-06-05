# Settings & gouvernance — note live + portée

## Live-testé
### C1 `/settings/icp` (ICP & Product) — VIDE
Preuve : `screenshots/030-settings-icp-C1.png`.
- Champs : Product description, Sales motion, Primary challenge, AI tone, Target industries, Company sizes (1-10…10,001+), Decision-maker roles. **Tous vides/non sélectionnés.**
- "This data drives AI scoring, outbound targeting, and deal coaching" — mais AI scoring = LLM off (C1), et l'ICP réel du scoring est ailleurs (C7).
- Settings sidebar visible : Account (Guardrails, Privacy & data, Security, Settings) / Workspace (General, ICP & Product, ICP Profiles, Mail & Calendar, Capture approvals, Members, Knowledge, Notifications, Opportunity Stages, Data Model) / Billing.
- **La section "Admin" (Evaluations, LLM Budget, MCP) n'apparaît PAS** dans le sidebar pour cet utilisateur → gating admin de la NAV fonctionne (mais statique : URLs admin restent non protégées côté serveur — `settings.md`).

## Portée non live-testée (s'appuie sur la baseline statique `code-analysis/settings.md`)
Budget/contexte + fragilité navigateur → non parcourus en live, couverts par l'analyse de code :
- Gouvernance : `/settings/guardrails` (agentApprovalMode — gate seulement 4 create-tools), `/settings/autonomy` (URL-only), `/settings/llm-budget` (pas de guard serveur), `/settings/llm-evals` (hors nav). G1/G2.
- Réglages inertes vs câblés : voir `settings.md` (11 câblés / 15 cosmétiques). Plays non injectés dans l'agent ; defaultDataVisibility non appliqué ; Slack notif non implémenté ; pricing $99 vs $149.
- `/voice-of-customer` (N30) et `/graph` (N31) : isolés (statique `ai-chat.md` — VoC sans conscommateur, graph backend-only). Non live-testés.
- Phase A (logout → signup → onboarding pour un tenant neuf) : **non exécutée** (mutation + fragilité). MAIS le vrai onboarding a été observé en live (carte `onboarding-confirmation-card.tsx` sur /home, N16) → l'essentiel du funnel d'activation est couvert ; le wizard `/onboarding-v3` est confirmé code mort.

## Gaps
- G-SET-1 [S1] ICP settings vide vs ICP effectif du scoring (→ C7).
- G-SET-2 [admin, statique] URLs admin (llm-budget) non protégées côté serveur malgré le masquage nav.
- G-SET-3 [statique] réglages cosmétiques/non câblés (15) — voir settings.md.
