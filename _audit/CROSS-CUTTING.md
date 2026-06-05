# Findings cross-cutting (prod-wide) — au-dessus des nœuds

## C1 — [S0] LLM NON CONFIGURÉ EN PROD
Preuve (N2, ID Quantique, `screenshots/004`) :
- "ICP FIT 50% — Automated ICP fit scoring unavailable (LLM not configured)"
- "COMPETITIVE LANDSCAPE — No competitive analysis available (LLM unavailable)"
- "AI INTELLIGENCE — Not enough data yet…"

Impact : toute la couche intelligence dépendante du LLM est inerte en prod — ICP fit scoring, analyse concurrentielle, AI intelligence par compte, probablement RAG/recherche knowledge du chat, smart search NL, personnalisation des openers. L'enrichissement non-LLM (Apollo : funding/tech-stack/hiring) fonctionne.
Cohérent avec baseline (`ai-chat.md` : RAG/knowledge échouent en silence sans `OPENAI_API_KEY`).
À confirmer sur : chat (X2/X3), smart search /accounts, scoring rationale (rule-based vs LLM), insights.
**Conséquence audit** : noter quand une lacune vient du LLM-off (config prod) vs d'un manque produit (code). Les deux comptent mais le fix diffère (clé API vs dev).

**CONSÉQUENCE LA PLUS VISIBLE — le CHAT est cassé en prod** : `POST /api/chat => 500` (testé live, query lecture seule → "Something went wrong"). La feature centrale du produit "chat-first" ne répond pas. Cascade des surfaces LLM mortes en prod : chat, input chat du Home, smart search NL (/accounts, /contacts), reports IA (/reports), ICP fit + competitive landscape (fiche compte), playbook extractor, probablement RAG/knowledge. **C'est le finding #1 de l'audit : sans clé LLM en prod, ~la moitié de la proposition de valeur est inerte.** Fix = configurer la clé LLM sur Vercel (env prod). Voir N27.

## C2 — [bug, S2] React #418 (hydration mismatch) récurrent
Confirmé sur **/proposals** et **/inbox** (même stack rD/oq/iw, chunk 4bd1b696). Home a été corrigé par `65eb20bd` (defer locale date to mount) mais le composant partagé persiste ailleurs → probable date/heure locale (ou autre valeur non-déterministe) rendue SSR ≠ client dans un composant de layout/liste partagé. Non-fatal (React re-render client) mais pollue la console et signale une racine SSR non traitée. Fix = même pattern que 65eb20bd, appliqué au composant partagé.

Annexe : `/proposals` et `/inbox` n'émettent pas de `<title>` propre (retombent sur le titre marketing) — métadonnée manquante, mineur.

## C3 — [à confirmer] /api/notifications ERR_NAME_NOT_RESOLVED
Sur /inbox, `/api/notifications?limit=20` (poll 30s du NotificationBell) a échoué 2× en ERR_NAME_NOT_RESOLVED (DNS). Même origine que des requêtes qui marchent → **probablement un hoquet DNS du sandbox Playwright**, pas un bug app. Si réel/persistant : le poller notifications échoue en silence (impacte X5). À reconfirmer hors sandbox.

## C4 — [polish/i18n, S2] Incohérence de langue FR/EN
`/call-mode` est intégralement en **français** ("À appeler maintenant", "File vide. Importez ou enrichissez des contacts pour démarrer", "Sélectionnez un contact…") alors que `/accounts`, `/contacts`, `/opportunities`, `/inbox`, `/proposals`, `/home` sont en **anglais** (avec dates en français "ven. 5 juin"). Locales mélangées, non gérées par un i18n cohérent. Visible et gênant pour un produit à wedge francophone (devrait être FR partout, ou au minimum cohérent). À cartographier sur les autres pages au passage.

## C5 — [polish, S2] Empty states / copies fuient du jargon interne (dev)
Plusieurs surfaces exposent du vocabulaire technique au user au lieu de guidance produit :
- `/insights/playbook` : "The capture **Inngest fn** fans in from calls… once the **LLM extractor** is wired"
- `/insights/hot-to-call` : "voice **Phase 1** ships the dialer; **Phase 2** adds the number waterfall"
Ce sont des notes de dev. À réécrire en langage utilisateur (récurrent → passe globale de copy).

## C6 — [nav/discoverability, S1] Beaucoup de features réelles sont hors nav (URL-only)
Absentes du sidebar et non liées ailleurs → quasi invisibles pour l'utilisateur :
`/deliverability`, `/reports`, `/insights/hot-to-call`, `/insights/playbook`, `/insights/pilae`, `/cs/today`, `/voice-of-customer`, `/graph`, `/onboarding-v3`, `/settings/autonomy`, `/settings/llm-evals`.
Plusieurs sont des features à valeur réelle (reports IA, hot-to-call, deliverability) qu'un user ne trouvera jamais. Le produit a beaucoup plus de surface que la nav n'en révèle → lacune majeure de découvrabilité. (Lié au méta-finding "archipel" : non seulement les arêtes entre pages manquent, mais des pages entières ne sont reliées à rien.)
Mitigation partielle : le **command palette (⌘K) fonctionne** et liste Deliverability/Reports/etc. → atteignables au clavier, mais pas pour le user lambda qui ignore ⌘K.

## C7 — [S1] ICP fragmenté / déconnecté entre stores (ICP→TAM cassé en pratique)
Preuve : `screenshots/030-settings-icp-C1.png`. `settings/icp` ("ICP & Product") = **VIDE** pour ce workspace (Product description, Target industries, Company sizes, Decision-maker roles — tous vides) **alors que 767 comptes existent et sont scorés** contre un ICP effectif (tooltips N1 : "Geography mismatch: …France" ⇒ ICP géo = Suisse romande).
→ L'ICP qui **score** la TAM n'est PAS celui exposé/éditable dans `settings/icp`. Stores ICP disjoints : carte onboarding (vide) / `tenants.settings` via settings/icp (vide) / table `icps` (ICP Profiles, ?) / l'ICP effectif du scoring (ailleurs). Un user qui édite settings/icp **ne contrôle pas** l'ICP réel de sa TAM. La page affirme "This data drives AI scoring" — or l'AI scoring est LLM-off (C1). → couture S2/E4 (ICP→TAM) cassée en pratique malgré le live-count présent dans la card onboarding.
