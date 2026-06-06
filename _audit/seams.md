# Coutures notées (inter-feature) — le cœur de l'audit fluidité

Score : **1.0** traverse (contexte porté) · **0.5** partiel (navigue mais perd le contexte) · **0.0** cul-de-sac · **N/T** non live-testé (verdict statique).
Source : `live` = vérifié sur prod ce jour ; `statique` = `code-analysis/*`.

## Funnel (E)
| id | couture | score | source | verdict |
|----|---------|-------|--------|---------|
| E1 | sign-up → verify-email | N/T | statique | câblé en code ; email externe droppé (Resend test mode) |
| E2 | verify-email → onboarding | N/T | statique+live | le vrai onboarding = carte /home (N16), pas le wizard |
| E3 | onboarding → home | 0.75 | live | carte single-screen sur /home ; mais contenu /home nondéterministe (G-N16-1) |
| E4 | onboarding(ICP) → TAM | 0.5 | live | live-count présent dans la card, MAIS ICP fragmenté (C7) |
| E5 | accept-invite → home | N/T | statique | non testé |

## Cœur GTM (S)
| id | couture | score | source | verdict |
|----|---------|-------|--------|---------|
| S1 | Home card → cible (contexte) | 0.5 | live+statique | cartes → pages liste sans entityId ; widgets sans handler |
| S2 | ICP → Accounts | 0.5 | live | ICP fragmenté (settings vide vs ICP effectif du scoring, C7) |
| S3 | Accounts → Account detail | **0.5** | live | nom = button→slide-over (pas d'URL) ; slide-over→expand vers /accounts/[id] |
| S4 | Account detail → Contacts | **0.0** | live | aucune section/affordance contacts ("Best contact: Unknown") |
| S5 | Account detail → Brain | **1.0** | live | "View brain" → hub d'agrégation 360° (la seule couture nickel) |
| S6 | Contacts → Contact detail | N/T | statique | 0 contacts ; company→account = texte (statique) |
| S7 | Contact → Call Mode | 0.0 | statique | pas de ?contactId= ; call-mode ne prend que ?accounts= |
| S8 | Contact/Account → Campaign | 0.0 | statique | aucun enrôlement individuel ; wizard = filtre ICP only |
| S9 | hot-to-call → Call Mode | 0.0 | statique | bouton Call → toast, n'ouvre pas /call-mode |
| S10 | playbook → action | 0.0 | live | read-only (+ Add entry manuel) ; pas d'action exécutable |
| S11 | Call → outcome → Note/Task/Deal | 0.0 | statique | aucune capture d'outcome dans l'UI (async Inngest only) |
| S12 | Campaign → Inbox / contact | **0.0** | live | enrolled "Test Contact" = `<td>` brut, 0 lien ; pas de lien thread inbox |
| S13 | Inbox reply → Task/Opportunity | 0.0 | statique | contactId/dealId pas passés au composer |
| S14 | Meeting → Notes/Tasks/Deal | 0.0 | live+statique | liste→fiche inatteignable ; "Upload transcript"→meeting-not-found ; tasks silencieuses |
| S15 | Opportunity → Proposal | **0.0** | live | proposals template-first en silo ; pas de picker deal ; opp sans companyId |
| S16 | Proposal → Opportunity | 0.0 | statique | silo, pas de retour d'état |
| S17 | Notes/Tasks → entité | **0.0** | live | tâches sans badge/lien entité (entityType/Id stockés non rendus) |
| S18 | Reports/Insights → drill | 0.5 | live | insights thin ; reports = generate (LLM off), pas de drill |

## Transverse (X) & gouvernance (G)
| id | couture | score | source | verdict |
|----|---------|-------|--------|---------|
| X1 | ⌘K → entité/page | 0.75 | live | palette OK, navigue vers pages (incl. orphelines) ; entity-jump non confirmé (crash) |
| X2 | Chat → action CRM | **0.0** | live | `/api/chat` 500 — chat cassé en prod (LLM off) |
| X3 | Chat → Knowledge | 0.0 | live | chat 500 + knowledge vide |
| X4 | Skills → invocation | 0.0 | live | /skills SYSTEM=0 (ne reflète pas les ~26 skills agent) ; chat cassé |
| X5 | NotificationBell → source | N/T | live | non testé ; /api/notifications ERR_NAME_NOT_RESOLVED (probable env) |
| X6 | capture-approvals → CRM | N/T | statique | human-in-loop câblé (statique), non testé |
| X7 | VoC → Insights/Knowledge | 0.0 | statique | VoC isolé, aucun consommateur |
| G1 | Guardrails/Autonomy → Engage | 0.5 | statique | agentApprovalMode gate 4 create-tools (pas les updates) ; autonomy URL-only |
| G2 | LLM budget/evals → observabilité | N/T | statique | admin ; llm-budget URL non protégée |

## Lecture d'ensemble
- **1.0 (traverse)** : 1 couture (S5 Account→Brain). 
- **0.5 (partiel)** : 6.
- **0.0 (cul-de-sac)** : 13.
- **N/T** : 6 (data absente / Phase A non jouée).
Sur les coutures testables, la **très grande majorité sont des culs-de-sac** — le produit ne fait pas circuler le contexte entre ses features. La seule couture exemplaire (S5→Brain) montre que c'est faisable ; le reste ne le fait pas.
