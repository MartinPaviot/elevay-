# Gap Register — backlog priorisé (audit live prod, 2026-06-05)

Type : `cross` (prod-wide) · `seam` (entre features) · `node` (dans un écran) · `bug`.
Sévérité : S0 bloquant · S1 majeur · S2 mineur · S3 polish. Trié par sévérité.

## S0 — bloquant (la valeur cœur ne fonctionne pas en prod)
| id | gap | type | preuve | fix |
|----|-----|------|--------|-----|
| C1 | **LLM non configuré en prod** → `/api/chat` **500** (chat cassé), + ICP fit / competitive / smart search / reports IA / input chat Home tous inertes | cross | 025, 030, N2, net 500 | configurer la clé LLM (Anthropic/OpenAI) sur Vercel prod |

## S1 — majeur (parcours cassé / culs-de-sac sur le happy path)
| id | gap | type | preuve | fix |
|----|-----|------|--------|-----|
| A | **Archipel** : le contexte ne circule pas — S4, S7, S8, S9, S11, S12, S13, S14, S15, S16, S17 = culs-de-sac. Clés (companyId/contactId/dealId/threadId/entityId) stockées mais arêtes non rendues | seam | seams.md, N13 (td brut), 012 | rendre les liens : enrolled→contact, opp→account/proposal, contact→deals, meeting→detail/tasks, notes/tasks→entité, hot-to-call→call-mode |
| B | **Dernier mètre vers l'action manquant** : insights/brain/deliverability/playbook = read-only sans handoff exécutable | seam | 017-021, N3 | ajouter CTA d'action (Call/Enroll/Create) sur les surfaces de lecture |
| C | **Boucle d'outcome ouverte** : fin d'appel / meeting → pas de capture→task→deal dans l'UI | seam | N11, N18 | UI de capture post-appel/meeting + back-links |
| C6 | **Routes orphelines** : deliverability, reports, insights/*, cs/today, voice-of-customer, graph, onboarding-v3 hors nav | cross | 022, 023, palette 028 | exposer dans la nav (ou supprimer le mort) ; ⌘K mitige partiellement |
| C7 | **ICP fragmenté** : settings/icp vide vs ICP effectif qui score 767 comptes ; user ne contrôle pas l'ICP réel | cross/seam | 030, N1 tooltips | unifier les stores ICP (carte onboarding / tenants.settings / icps) sur une source unique |
| N18-1 | **"Upload transcript" cassé** → `/meetings/upload` = "Meeting not found" | bug | 014 | créer la route/flow d'upload (ou modal) au lieu de tomber dans [id] |
| N16-1 | `/home` **contenu nondéterministe** (carte onboarding vs dashboard) même route | bug | 001 vs 029 | flag d'état onboarding déterministe |
| N16-4 | `/onboarding-v3` wizard = **code mort** (vrai onboarding = la card) | node | N16 | supprimer le wizard + sa route |

## S2 — mineur (états/cohérence hors chemin cœur)
| id | gap | type | preuve | fix |
|----|-----|------|--------|-----|
| C2 | React **#418 hydration** récurrent (/proposals, /inbox…) | bug | console | appliquer le pattern du fix Home (65eb20bd) au composant partagé |
| C4 | **i18n FR/EN mélangé** (call-mode 100% FR, playbook "accroches" en EN) | cross | 010, 019 | i18n cohérent (FR partout pour le wedge francophone) |
| C5 | **Empty states fuient du jargon dev** ("Inngest fn", "LLM extractor", "voice Phase 1/2") | cross | 018, 019 | réécrire en langage user |
| N15-1 | Deliverability **HEALTH SCORE 0/POOR** trompeur sur zéro activité | node | 021 | N/A au lieu de POOR sur 0 envoi |
| N1 | Accounts : pas de skeleton ; "Delete all" en tête (risqué) ; double search Smart/Semantic ; erreurs avalées | node | 002 | skeleton ; déplacer Delete all ; clarifier search ; états error |
| N3-2 | **Score incohérent** entre vues (liste "F" / fiche "1" / brain "0.8") | node | 004, 005 | représentation unique du score |
| N25 | Page **dogfood Pilae** ("Paul", 1 M€, cron) exposée comme route produit | node/admin | 020 | tenant-gater |
| SET-2 | URLs admin (llm-budget) non protégées serveur (masquées en nav seulement) | node | statique | `adminOnlyOrRedirect()` serveur |
| N13-3 | Incohérence data : séquence "1 contacts" mais /contacts = 0 | data | 011, 012 | réconcilier compteur/liste |
| N21-2 | "533d overdue" sans borne d'affichage | node | 016 | borne/sanity |

## S3 — polish
| id | gap | type | preuve | fix |
|----|-----|------|--------|-----|
| N13-4 | Vocabulaire Campaign / Sequence / "Updated Sequence" incohérent | polish | 011 | un seul terme |
| C2b | /proposals, /inbox sans `<title>` propre (titre marketing par défaut) | polish | nav | metadata par page |
| N23/N17 | "voice Phase 1/2", "cron 04:00 UTC" exposés (sous-ensemble de C5) | polish | 018, 023 | copy user |

## Non confirmés (à revérifier hors sandbox)
- C3 `/api/notifications` ERR_NAME_NOT_RESOLVED (probable hoquet DNS sandbox, pas un bug app).
- X1 entity-jump du ⌘K (crash navigateur avant confirmation ; pages OK).
