# Sweep des empty states (pages aval) — PROD, workspace "E2E Test Workspace"

État data du workspace : **767 comptes (TAM), 0 contact** → l'aval (contacts/deals/meetings/activités) est essentiellement vide. C'est en réalité l'**expérience premier-run** d'un user qui a build sa TAM mais pas encore engagé. Donc ces empty states sont à juger sur : (a) clarté, (b) **CTA de sortie vers la prochaine étape du fil rouge**.

Barème empty-state : 1.0 = guide clairement vers l'action suivante ; 0.5 = message ok mais sans pont ; 0.0 = trou noir.

---

### N4 — `/contacts` — VIDE (0) — empty-state **1.0**
Preuve : `screenshots/006-contacts-N4.png`
- Message : "No contacts yet — Get your first contacts in two clicks — import a CSV … or let Apollo find decision-makers at your TAM accounts."
- CTA : **Import CSV** (primaire) + **Find contacts at top accounts** (secondaire) → fait le pont **TAM(767)→contacts** (bonne couture de sortie).
- Header : Find duplicates, Smart Import, Import CSV, Create contact ; + Search + Smart search.
- Gap : Smart search présent mais dépend du LLM (off en prod → à vérifier). Sinon empty state exemplaire.

---

### N7 — `/opportunities` (Pipeline) — VIDE (0 deals) — empty-state **0.5**
Preuve : `screenshots/007-opportunities-N7.png`
- Structure riche : métriques (Pipeline/Won/Win rate/Avg deal/Velocity/At risk = 0), board Kanban 6 stages (Lead → Qualification → Demo → Trial → Proposal → Negotiation), toggle Board/Table, Forecast, Analytics, Analyze Pipeline.
- Empty-state = **structurel** : board vide + "Create opportunity" par stage, MAIS **aucun pont fil-rouge** (pas de "convertis un compte/contact en deal", pas de message d'amorçage). User avec 767 comptes voit un pipeline vide sans passerelle depuis l'amont.
- Note : "Proposal" est un **stage** du pipeline → recouvre la feature `/proposals` (relation S15/S16 à clarifier : un deal en stage Proposal vs l'objet Proposal).
- Gaps : G-N7-1 empty state sans bridge upstream (S2) ; G-N7-2 Forecast/Analytics dépendent probablement du LLM (off prod) — à vérifier.

---

### N9 — `/proposals` — VIDE (no templates) — empty-state **0.5**
Preuve : `screenshots/008-proposals-N9.png`
- Modèle : "Upload a Word or PowerPoint template; Elevay maps its components so it can be drafted per prospect." Action unique : **Upload template**. Two-pane (templates / composants détectés). Cohérent avec projet proposal-autodraft.
- Empty-state explique le modèle mais **template-first** : aucun pont depuis un deal. Confirme statique **S15 cassé** (deal id à taper à la main, pas de picker, pas d'entrée "draft proposal" depuis Opportunities/un deal).
- **BUG : React #418 (hydration mismatch)** au chargement (console, 1 erreur). Même classe que le fix Home `65eb20bd`, non appliqué à /proposals.
- Gaps : G-N9-1 [S1] proposals en silo, non relié au pipeline (S15) ; G-N9-2 [bug] #418 hydration sur /proposals.

---

### N10 — `/inbox` — VIDE (0 emails) — empty-state **~1.0**
Preuve : `screenshots/009-inbox-N10.png`
- Tabs All/Replied/Awaiting/Bounced (tous 0). Empty : "No emails — Send your first sequence to see emails here." → bon pont **inbox ← sequences** (S12).
- Signaux techniques : #418 hydration (voir CROSS C2) ; `/api/notifications?limit=20` → ERR_NAME_NOT_RESOLVED 2× (poll 30s, probable env). Titre = défaut marketing (page ne set pas son `<title>`).
- Seams reply→task/deal : non testables (0 email) → s'appuyer sur statique (contactId/dealId pas passés au composer).

---

### N11 — `/call-mode` — VIDE (queue 0) — empty-state **~0.75**
Preuve : `screenshots/010-call-mode-N11.png`
- **Cockpit 3 panneaux** : file "À appeler maintenant" (chips Tous / High intent / Trial expiring / Reply received) | softphone ("Sélectionnez un contact dans la file") | contexte compte ("Sélectionnez un contact pour voir le compte"). Bonne structure de poste d'appel.
- Empty : "File vide. Importez ou enrichissez des contacts pour démarrer." → pont vers contacts/enrich.
- **i18n : page 100% FRANÇAIS** alors que le reste est en anglais → voir CROSS C4.
- Statique (non testable, 0 contact) : chips Trial expiring/Reply received = placeholders (renvoient toute la file) ; pas de `?contactId=` (S7) ; **fin d'appel sans capture d'outcome** (S11).
- Gaps : G-N11-1 [S1] pas d'entrée ciblée contact→call (S7) ; G-N11-2 [S1] boucle outcome non fermée (S11, statique) ; G-N11-3 [i18n] langue FR isolée.

---

### N18 — `/meetings` — VIDE (0) — empty-state **~1.0**
Preuve : `screenshots/013-meetings-N18.png`
- Empty : "Connect your calendar — Connect Google or Microsoft Calendar so Elevay can see your meetings here and auto-join with a recording bot." CTA **Go to settings**. Header : **Upload transcript**.
- Bon empty state (value prop claire + CTA vers settings/mail-calendar).
- **BUG CONFIRMÉ (S1)** : clic "Upload transcript" → `/meetings/upload` → **"Meeting not found"** (la route tombe dans `[id]`, "upload" lu comme un id). Le CTA primaire d'ajout de meeting est cassé. Preuve : `screenshots/014-meetings-upload-404.png`. → G-N18-1.
- Gaps : G-N18-1 [S1/bug] CTA "Upload transcript" cassé (→ meeting-not-found) ; G-N18-2 [seam, statique] liste→fiche meeting inatteignable depuis la nav normale ; G-N18-3 [seam, statique] meeting→tasks créées sans back-link.

---

### N20 — `/notes` — VIDE (0) — empty-state **~0.75**
Preuve : `screenshots/015-notes-N20.png`
- Composer inline "Write a note…" en tête, "Create note", search, sort "Newest". Empty : "No notes yet — Capture meeting notes, observations, and insights here." Propre.
- Standalone (pas d'amorçage lié à une entité). Statique : notes stockent entityType/entityId mais **back-link non rendu** (S17) — non testable (0 note).

---

### N21 — `/tasks` — POPULATED (4) — (nœud peuplé, pas empty)
Preuve : `screenshots/016-tasks-N21.png`
- Badges 3 pending / 2 overdue. Tabs All/Due today/Overdue/Completed. Inline "Add a task…" + Add. Sort Priority. Toggle complété OK (strikethrough).
- Tâches : "Review pipeline by Friday" (High, 533d overdue), "Review the pipeline health" (High, 140d overdue), "E2E UI Task" (High), "E2E Full Test Task" (done).
- **S17 task→entité** : aucune des tâches n'affiche de badge/lien entité → back-link absent (cohérent statique : entityType/entityId stockés, rendus en texte).
- Gaps : G-N21-1 [S1/seam] task→entité back-link absent (S17) ; G-N21-2 [edge] "533d overdue" sans borne/sanity d'affichage.

---

### N22 — `/insights` — quasi-VIDE — empty-state **0.5**
Preuve : `screenshots/017-insights-N22.png`
- Une seule section "Pipeline" : 4 cartes (Open Deals 0, Total Value $0K, Weighted $0K, Win Rate —). Tout à 0.
- **Thin & redondant** : n'expose RIEN des 767 comptes (pas de hot accounts / signaux / recos) ; doublonne la barre métriques de `/opportunities`.
- **Discoverabilité** : aucun onglet/lien vers les sous-pages `/insights/hot-to-call`, `/playbook`, `/pilae` → URL-only, non découvrables depuis la nav (sidebar "Insights" → `/insights` uniquement).
- Gaps : G-N22-1 [valeur] /insights = simple résumé pipeline, n'expose pas l'intelligence comptes ; G-N22-2 [nav] sous-insights orphelines (non liées).

---

### N23 — `/insights/hot-to-call` — VIDE (0) — empty-state **0.75**
Preuve : `screenshots/018-insights-hot-to-call-N23.png`
- "Contacts who opened, clicked, or visited recently — sorted by how hot. Polls every 30s." Chips Last hour / 24h / 7d. "0 contacts · last refresh … · window 168h".
- Empty honnête/informatif : "No callable hot leads in the last 168h. Either no signals fired, or none of the engaged contacts have a phone on file. Contacts get a phone via Apollo enrichment (Kaspr/Lusha waterfall…)".
- **Polish** : la copie **expose du langage roadmap interne** au user ("voice Phase 1 ships the dialer; Phase 2 adds the number waterfall") → trop dev-facing.
- S9 hot-to-call→call-mode : non testable (0 contact) ; statique = bouton Call ne route pas vers /call-mode (toast).
- Gaps : G-N23-1 [polish] langage roadmap interne dans l'empty state ; G-N23-2 [S1/seam] hot-to-call→call-mode (statique).

---

### N24 — `/insights/playbook` — VIDE (0) — empty-state **0.5**
Preuve : `screenshots/019-insights-playbook-N24.png`
- "Objections, accroches, questions — distilled from every call, meeting, reply." Chips All/Objections/Accroches/Questions. "Add entry".
- Empty **fuit du jargon dev** : "The capture **Inngest fn** fans in from calls, meetings, and replies once the **LLM extractor** is wired — or use Add entry." (+ "accroches" FR dans phrase EN). → CROSS C5.
- Dépend du LLM (off) + données calls/meetings (0). "Add entry" = fallback manuel (bien).
- Statique : entries sans lien vers le meeting source (sourceActivityId stocké, non rendu).
- Gaps : G-N24-1 [polish] jargon dev dans empty state (→ CROSS C5) ; G-N24-2 [seam] playbook→meeting source absent.

---

### N25 — `/insights/pilae` — INTERNE (dogfood) — 
Preuve : `screenshots/020-insights-pilae-N25.png`
- "Pilae bookings — Dogfood track — funnel, bookings split, deep-dive capacity. Polls every 60s." 3 cartes : Bookings vs target ("0% of 1 M€ — never blended with ARR"), Funnel by stage (0 deals), Deep-dive capacity (**Paul**) ("No snapshot yet — capacity cron runs Monday 00:30 UTC").
- = **page interne Pilae-spécifique** (références "Paul", "1 M€", cron) → pas une feature générique. Devrait être gated admin/tenant, pas exposée comme route produit. Respecte bien la convention bookings≠ARR.
- Gaps : G-N25-1 [admin] page dogfood interne exposée comme route produit (à tenant-gater).

---

### N15 — `/deliverability` — structure peuplée, 0 envois
Preuve : `screenshots/021-deliverability-N15.png`
- **HEALTH SCORE 0 "POOR"** (rouge, top-right) alors que la mailbox HEALTH = 100 et 0 envoi → **score santé global trompeur** (faux négatif sur zéro activité ; devrait être N/A/neutre).
- Métriques Sent/Open/Reply/Bounce/Spam/Replied (0). Mailbox health (e2e@test.com, "Warming up", 100, 0/50, 0 bounces). Sequence enrollments (Active 1). Empty zone : "No emails sent yet — Start sending sequences to see deliverability metrics." (bien).
- Read-only (statique : recos = texte, pas de boutons de nav).
- Gaps : G-N15-1 [UX] HEALTH SCORE 0/POOR trompeur sur zéro activité ; G-N15-2 [seam] recos sans nav vers settings/sequences/inbox (statique).

---

### N26 — `/reports` — catalogue (URL-only)
Preuve : `screenshots/022-reports-N26.png`
- 3 rapports IA : **Pipeline Report**, **Weekly Report**, **Win/Loss Report** — chacun **Generate** + **Schedule weekly**. "AI-generated executive reports" → LLM-dépendant (off prod → génération probablement vide/échouée ; non cliqué pour éviter coût/échec).
- **URL-only** : absent du sidebar → non découvrable. → CROSS C6.
- Gaps : G-N26-1 [nav] /reports orphelin (C6) ; G-N26-2 [LLM] génération dépend du LLM (off).

---

### N17 — `/cs/today` — VIDE (URL-only)
Preuve : `screenshots/023-cs-today-N17.png`
- "Today — Accounts ranked by risk × ARR. The daily queue a Founding CS would look at first." Refresh. Empty : "No health snapshots yet. The CS health cron runs daily at 04:00 UTC. After it executes, accounts that need attention will appear here, ranked."
- Feature CS post-vente (churn risk × ARR). URL-only (C6). Expose "cron 04:00 UTC" (C5 léger).
- Gaps : G-N17-1 [nav] orphelin (C6) ; G-N17-2 [polish] "cron 04:00 UTC" exposé au user.

---

### N28 — `/knowledge` — VIDE — empty-state **0.75**
Preuve : `screenshots/026-knowledge-N28.png`
- Two-pane, scopes **WORKSPACE (0)** + **PERSONAL (0)**, "No entries yet" + "Add knowledge". Right : "Select an entry to view details". Propre.
- Alimente le RAG du chat (statique) — mais chat cassé (C1) + knowledge vide → RAG non testable. X3 bloqué.

---

### N29 — `/skills` — VIDE — empty-state **0.75**
Preuve : `screenshots/027-skills-N29.png`
- Toggle List/Explore, "Create skill". Scopes **SYSTEM (0)** / **WORKSPACE (0)** / **PERSONAL (0)** "No skills yet". Right : "Select a skill to view details".
- **Déconnexion** : SYSTEM = 0 alors que la baseline (`ai-chat.md`) montre ~26 skills **hardcodés** appelables par le chat. La page /skills ne surface pas les skills réels de l'agent → l'utilisateur ne voit pas ce que l'agent sait faire. (X4)
- Skills non invocables de toute façon (chat cassé). "Explore" non exploré.
- Gaps : G-N29-1 [X4] /skills ne reflète pas les skills built-in de l'agent (SYSTEM 0 vs ~26 en code).
