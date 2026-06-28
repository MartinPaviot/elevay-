# Orion — PROMPT 00 : SETUP opérateur (auto-piloté)

> À coller dans une session **Claude Code ouverte à la racine du repo Orion VIDE**.
> Claude Code exécute lui-même tout l'amorçage automatisable, te réclame les seules
> entrées humaines (chaînes DB, clés API), puis te rend un rapport « ce que tu dois
> faire » + le prompt de la Vague 0. Il **ne construit pas** (pas de pack0/pack1).
> Prompts de build : `spec/LAUNCH-KIT.md` (le SETUP te les remet à la fin).

```
Tu es la session SETUP d'Orion (pré-lancement opérateur). Le repo est VIDE. Ta mission :
exécuter TOI-MÊME chaque étape d'amorçage automatisable, me demander les seules entrées
humaines (chaînes DB, clés API), exécuter ce que tu peux, puis finir par un rapport
"CE QUE JE DOIS FAIRE (humain)" + le prompt suivant. NE COMMENCE PAS à construire de
features (pas de pack0/pack1) dans cette session — arrête-toi au feu vert.

Source de vérité : C:/Users/ombel/leads/orion (corpus déjà rédigé).

0) Copie le corpus dans ce repo :
   cp -r /c/Users/ombel/leads/orion/spec ./spec
   cp -r /c/Users/ombel/leads/orion/research ./research
   cp -r /c/Users/ombel/leads/orion/brand ./brand
   cp    /c/Users/ombel/leads/orion/README.md ./README.md
   Puis LIS, dans l'ordre : spec/SETUP-RUNBOOK.md (fait foi sur les mécanismes),
   spec/00-PREREQUISITES.md, spec/MCP-AND-PERMISSIONS.md, spec/AUTONOMY-SETUP.md,
   spec/LAUNCH-KIT.md. Suis SETUP-RUNBOOK à la lettre.

1) Amorçage (SETUP-RUNBOOK §1) : .nvmrc=22 ; corepack enable && corepack prepare
   pnpm@10.15.1 --activate ; .gitignore d'amorçage (§1.4) ; commit
   "chore(foundation): bootstrap Orion repo (spec/research/brand + Node 22 + pnpm 10.15.1)" ;
   git push -u origin main (gh = MartinPaviot, déjà configuré). NE FAIS PAS pnpm install
   (pas de package.json — pack0 le scaffolde). NE CRÉE PAS package.json/tsconfig/next.config.

2) Posture autonomie + MCP :
   - CLAUDE.md à la racine = copie de spec/CLAUDE.md.
   - .mcp.json (context7 + playwright) + .claude/settings.local.json (allowlist LECTURE
     SEULE) = blocs de spec/MCP-AND-PERMISSIONS.md §A/§B copiés tels quels ; vérifie
     0 outil mutateur Playwright dans "allow".
   - .claude/settings.json + hooks (secret-scan + tsc) = spec/AUTONOMY-SETUP.md §2
     (settings.json committé + secret-scan.sh + typecheck.sh) ; chmod +x les .sh.
   - Scaffolding autonomie (spec/AUTONOMY-SETUP.md §3) : copie depuis Elevay les
     sub-agents .claude/agents/{code-reviewer,spec-kiro}.md, les commands
     .claude/commands/{next,code-review,investigate,status,plan}.md (+ les .sh
     plan-command/review-plan-command) et .claude/output-styles/detail-over-vision.md,
     en adaptant les chemins (src/, @orion/web, tenant elevay).
   - Refs _harness/_reports + mémoire (spec/AUTONOMY-SETUP.md §4, templates fournis) :
     crée _harness/{CHARTER.md,escalation.md,milestones.json,progress.txt} +
     _reports/{spending.md,harness-health.md} — sans eux le CLAUDE.md d'Orion frappe
     des refs mortes et la Vague 0 n'a ni off-ramp d'escalade, ni gate de budget, ni
     crash-recovery. Pose aussi le seed mémoire
     ~/.claude/projects/<repo>/memory/MEMORY.md (per-machine, GITIGNORÉ — pas committé).
   - Commit (config versionnée, aucun secret dedans ; la mémoire reste hors repo).

3) Secrets que tu génères TOI-MÊME (jamais commités) :
   - AUTH_SECRET : npx auth secret (valeur SANS guillemets, sans \n).
   - Clé MCP : RAW = "mcp_" + 16 octets hex ; keyHash = bcrypt(RAW, 10) ;
     keyPrefix = RAW.slice(0,8)+"..." ; émets l'entrée McpApiKeyEntry JSON
     (installe bcryptjs en tmp si besoin, cf §4.3). IMPRIME le RAW en clair —
     je dois le sauvegarder (c'est le Bearer de la démo).
   - Hash mot de passe admin : bcrypt('<motdepasse_que_tu_me_demandes>', 12).

4) Écris app/apps/web/.env.local depuis le modèle §2. Remplis ce que tu peux
   (AUTH_SECRET, AUTH_URL=http://localhost:3000, ORION_TENANT_ID=elevay, GDPR_REGION=eu,
   TARGETING_GATE_ENABLED=on, RESEARCH_AGENT_ENABLED=1, ORION_INGEST_ENABLED=on,
   ORION_EXPORT_ENABLED=on). Laisse des placeholders <A_REMPLIR> NETS pour :
   DATABASE_URL (elevay_app @ :6543), DATABASE_URL_OWNER (postgres @ :5432),
   ANTHROPIC_API_KEY, APOLLO_API_KEY, FIBER_API_KEY (source data sponsor, optionnel),
   INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY. Fiber = ENTREE (pas un sink) ; les cles SINK
   (Instantly/OrangeSlice/Lopus) ne vont JAMAIS en env (DB integration_credentials).
   Vérifie que .env.local est bien gitignore.

5) Génère le SQL prêt-à-exécuter dans setup/ (gitignore setup/*.local.sql : il porte les hash) :
   - setup/00-roles.sql : CREATE ROLE elevay_app + GRANT + ALTER DEFAULT PRIVILEGES (§3),
     idempotent.
   - setup/01-tenant-key.local.sql : INSERT tenant 'elevay' + auth_user (PWHASH déjà rempli)
     + users admin + jsonb_set append de l'entrée mcpApiKeys (keyHash déjà rempli) — SQL de §4.

6) Demande-moi les 2 chaînes Supabase (app :6543 / owner :5432) + les clés API. Si je te
   les donne (ou si je les ai déjà mises dans .env.local) : exécute TOI-MÊME
   psql "$DATABASE_URL_OWNER" -f setup/00-roles.sql puis -f setup/01-tenant-key.local.sql,
   et vérifie (elevay_app rolsuper=f/rolbypassrls=f ; SELECT id FROM tenants WHERE id='elevay' ;
   round-trip MCP curl initialize → 200 une fois le dev server up). Sinon, imprime les
   commandes exactes pour que je les lance.

7) Lance toutes les vérifs de SETUP-RUNBOOK §8 que tu peux (boot minimal 3 vars, aucune clé
   sink en env, ports :6543/:5432, flags du role).

8) TERMINE par un rapport "CE QUE JE DOIS FAIRE (humain)" :
   (a) le RAW de la clé MCP à sauvegarder ;
   (b) la liste exacte des <A_REMPLIR> de .env.local ;
   (c) les commandes psql à lancer si tu n'as pas pu te connecter ;
   (d) les connecteurs claude.ai à connecter : Apollo, datagouv, Vercel ;
   (e) ce que tu as DÉJÀ fait (fichiers créés + commits poussés) ;
   (f) l'ÉTAPE SUIVANTE : "ouvre une NOUVELLE session Claude Code dans ce repo et colle
       le prompt Vague 0" — et colle-moi ce prompt (section 'PROMPT — Vague 0, session A'
       de spec/LAUNCH-KIT.md).
   NE PASSE PAS à pack0/pack1 — arrête-toi ici.

Règles : no-emoji ; Conventional Commits ; git add explicite (jamais git add .) ;
re-vérifie branche+HEAD avant chaque commit ; jamais d'écriture role owner au runtime
(owner = migrations only) ; tenant elevay uniquement ; Context7 avant toute config de lib.
```
