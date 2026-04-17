# Teardown Rox — Analyse Compétitive Exhaustive

**Date**: 2026-04-16
**Sources**: rox.com, Not Boring (Packy McCormick), TechCrunch, Kavout, SelectHub, GlobalTill, SaaStr
**Méthode**: Recherche web exhaustive + analyse architecturale + comparaison feature-by-feature avec Elevay

---

## 1. Identité & Positionnement

| Attribut | Valeur |
|----------|--------|
| **Fondateur** | Ishan Mukherjee (ex-CRO New Relic, ex-Apple Siri PM, ex-Amazon Robotics) |
| **CTO** | Shriram Sridharan (ex-Confluent data infra, ex-Amazon Aurora) |
| **Co-founder AI** | Avanika Narayan (Stanford Knight-Hennessy Scholar, PhD LLMs) |
| **Équipe** | 14 personnes, tous engineers |
| **Funding** | $50M total — self-funded pre-seed, Sequoia seed, General Catalyst Series A |
| **Valuation** | $1.2B (Mars 2026) |
| **ARR** | ~$8M (fin 2025 projections) |
| **Clients** | Ramp, OpenAI, MongoDB, NVIDIA, Databricks, Coreweave, Confluent, New Relic |
| **Cible** | Global 2000, entreprises $100M-$1B+ revenue, tech-forward |
| **Tagline** | "No SaaS. No CRM. No enrichment. Just an agent that does it all." |
| **Siège** | 251 Rhode Island St, San Francisco |

**Positionnement clé** : Rox ne se positionne PAS comme un CRM. C'est un "Revenue Agent" — un système d'agents autonomes qui remplace le CRM, l'enrichissement, l'outbound, la conversation intelligence, et la revenue intelligence en un seul produit.

---

## 2. Architecture Produit

### 2.1 Agent Swarm Architecture

Rox utilise une architecture "Agent Swarm" — des essaims d'agents AI spécialisés, un par compte client :

```
┌─────────────────────────────────────────────────┐
│              AGENT SWARM PER ACCOUNT             │
│                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Account     │ │ Prospecting │ │ CRM         │ │
│  │ Monitoring  │ │ Agent       │ │ Enrichment  │ │
│  │ Agent       │ │             │ │ Agent       │ │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ │
│         │               │               │         │
│         └───────────┬───┘───────────────┘         │
│                     ▼                              │
│         ┌─────────────────────┐                    │
│         │ Unified Context     │                    │
│         │ (System of Record)  │                    │
│         └──────────┬──────────┘                    │
│                    ▼                               │
│         ┌─────────────────────┐                    │
│         │ Action Layer        │                    │
│         │ (Command, Plays,    │                    │
│         │  Outbound, Meet)    │                    │
│         └─────────────────────┘                    │
└─────────────────────────────────────────────────┘
```

**3 types d'agents** :
1. **Account Monitoring** — track usage patterns, support tickets, sentiment, renewal risks, upsell opportunities
2. **Prospecting** — scour public data, intent signals, web sources pour identifier et qualifier des leads
3. **CRM Enrichment** — update CRM automatiquement, suggest next actions, élimine la saisie manuelle

### 2.2 Warehouse-Native Architecture

Contrairement à Salesforce/HubSpot qui stockent les données dans leur propre cloud, Rox est **warehouse-native** :
- Les données restent dans l'infrastructure du client (Amazon Redshift, Snowflake, etc.)
- Rox se connecte au data warehouse existant
- Pas de migration de données nécessaire
- Le client garde le contrôle total de ses données

**Implication pour Elevay** : Elevay utilise Neon (PostgreSQL) comme source de vérité unique. L'approche warehouse-native de Rox est un différenciateur enterprise que nous n'avons pas et n'avons pas besoin pour notre cible SMB.

### 2.3 System of Context (Unified Data Fabric)

Rox combine :
- Données CRM privées (Salesforce, HubSpot)
- Intelligence publique (news, funding, job postings, filings)
- Données d'usage produit (si disponibles)
- Emails, calendrier, appels
- Support tickets (Zendesk)

Tout est fusionné dans un "System of Context" — un graphe de connaissances unifié en temps réel.

---

## 3. Modules Produit (Feature-by-Feature)

### 3.1 Research & Account Intelligence

| Feature | Description | Elevay Equivalent |
|---------|------------|-------------------|
| Org chart automatique | Construit l'organigramme de chaque compte à partir de données publiques | Pas d'organigramme |
| Buying signals | Consolidation de signaux d'achat (funding, hiring, tech adoption) | `weeklySignalScan` + 5 signal skills |
| Account briefing | Dossier complet par compte avant chaque call | `meeting-brief` skill + `autoMeetingPrep` |
| News monitoring | Suivi actualités par compte en continu | Pas de monitoring news continu |
| Public filings analysis | Analyse automatique des rapports financiers publics | Non |
| Job postings tracking | Suivi offres d'emploi pour détecter intent | `job-posting-intent` skill |

**Gap Elevay** : L'organigramme automatique et le monitoring continu de news sont absents. Les buying signals existent mais en mode batch (weekly cron), pas continu.

### 3.2 Outbound Agent + Outreach

| Feature | Description | Elevay Equivalent |
|---------|------------|-------------------|
| Prospecting autonome | Identifie leads, personnalise séquences, gère replies, schedule meetings | `apolloLeadFinder` + séquences + `handleReplyIntelligently` |
| Multi-step sequences | Campagnes outbound multi-étapes avec délais | `sequences` + `cronTriggerSequenceSteps` |
| Reply management | Classification + routing automatique des réponses | `handleReplyIntelligently` |
| Meeting booking | Schedule meetings automatiquement | `createMeeting` tool (partiel) |
| Personalization | Personnalisation basée sur le contexte complet du compte | `sendSequenceStep` avec LLM personalization |

**Gap Elevay** : La boucle prospecting→outreach→reply→meeting est plus intégrée chez Rox (un seul agent gère tout le cycle). Chez Elevay, c'est des pièces séparées (Apollo, séquences, reply handler, meeting booking).

### 3.3 Meet (Conversation Intelligence)

| Feature | Description | Elevay Equivalent |
|---------|------------|-------------------|
| Call recording | Enregistrement et transcription automatique | Recall.ai bot (`scheduleRecallBots`) |
| Structured insights | Extraction notes structurées, buying signals, sentiment | `autoMeetingPrep` + context graph extraction |
| Follow-up emails | Génération auto d'emails post-meeting | Post-call actions (copy/paste, pas auto-send) |
| Org chart mapping | Mapping automatique des participants à l'organigramme | Non |
| Action items | Extraction et tracking des action items | Extraction dans structured notes |

**Gap Elevay** : L'org chart mapping post-meeting et le follow-up email auto-send sont absents. Le recording via Recall.ai est équivalent.

### 3.4 Plays (Sales Process Templates)

| Feature | Description | Elevay Equivalent |
|---------|------------|-------------------|
| Repeatable templates | Top-performing strategies packagées en templates | `customSkillTemplates` table (pas encore d'UI) |
| Auto-execution | L'agent exécute le play automatiquement | `autoPipelineStep` (D2) |
| Performance tracking | Mesure l'efficacité de chaque play | Pas de tracking par play |
| Best-practice encoding | Encode les méthodes des meilleurs vendeurs | 28 skills avec prompts encodés |

**Gap Elevay** : L'UI pour créer/éditer les plays n'existe pas (la table `customSkillTemplates` est en DB mais pas exposée). Le tracking de performance par play est absent.

### 3.5 Command (Natural Language Interface)

| Feature | Description | Elevay Equivalent |
|---------|------------|-------------------|
| NL commands | "Run a campaign for CFOs in fintech who raised Series C in the last 9 months" | Chat avec 11 tool groups + 28 skills |
| Multi-step orchestration | Une commande déclenche une chaîne d'actions | Partiellement via le chat (le user doit guider chaque step) |
| Campaign creation | Créer une campagne en une phrase | `buildTAM` + `enrollInSequence` (2 steps) |

**Parité** : Le chat d'Elevay avec ses 11 groupes d'outils est fonctionnellement équivalent à Command. La différence est dans l'orchestration multi-step : Rox chaîne automatiquement les actions, Elevay demande confirmation step-by-step.

### 3.6 Opportunities (Deal Management)

| Feature | Description | Elevay Equivalent |
|---------|------------|-------------------|
| Autofill from conversations | Les champs du deal se remplissent automatiquement depuis les appels/emails | `enrichment-email-extract` pipeline (partial) |
| Buyer signal monitoring | Monitoring continu des signaux d'achat par deal | `signalToDealAlert` (D1) |
| Deal loss alerts | Alerte avant la perte d'un deal | `analyzeDealEvent` coaching |
| Custom deal workspace | Workspace par deal avec contexte complet | Deal detail page + scoped chat |

**Gap Elevay** : L'autofill des champs deal depuis les conversations est le gap principal. Le `enrichment-email-extract` extrait les signaux mais ne met pas à jour les champs du deal automatiquement.

### 3.7 Custom Apps & Agent-to-Agent Workflows

| Feature | Description | Elevay Equivalent |
|---------|------------|-------------------|
| Mini-apps builder | Construire des apps custom sur la plateforme | Non |
| Agent-to-agent | Agents cross-départements qui collaborent | Non |
| API & MCP | Intégration dans les outils existants | API routes + MCP settings |

**Gap Elevay** : Pas de builder d'apps custom ni de workflows agent-to-agent.

### 3.8 Native Apps

| Platform | Rox | Elevay |
|----------|-----|--------|
| Web app | Oui | Oui |
| Mobile iOS | Oui | Non |
| Desktop app | Oui | Non |
| Chrome extension | Oui | Non |

**Gap Elevay** : Pas d'apps natives (mobile, desktop, extension). Web-only.

---

## 4. Pricing Comparison

| Tier | Rox | Elevay |
|------|-----|--------|
| Free | Starter: $0/mo, 1000 actions, 10 agents | Trial (pas de pricing défini) |
| Core | $50/mo, 5000 actions | Pas de tier intermédiaire |
| Enterprise | Custom | Pas de pricing enterprise |
| Model | Action-based (chaque task = N actions) | Pas de modèle action-based |

**Implication** : Rox a un modèle freemium avec un tier gratuit qui permet de tester. Elevay n'a pas de pricing structuré.

---

## 5. Intégrations

| Integration | Rox | Elevay |
|-------------|-----|--------|
| Salesforce | Natif | Non |
| HubSpot | Natif | Non |
| Gmail | Natif | Natif (OAuth) |
| Outlook | Natif | Natif (OAuth) |
| Slack | Natif | Non |
| Google Workspace | Natif | Partiel (Calendar) |
| Microsoft 365 | Natif | Partiel (Calendar + Mail) |
| Zendesk | Natif | Non |
| Data Warehouse | Amazon Redshift | Non (Neon PG) |
| Chrome Extension | Oui | Non |
| Mobile App | iOS | Non |
| API | REST + MCP | REST |
| Custom MCP | Oui | Oui |

**Gap Elevay** : Pas d'intégration Salesforce/HubSpot/Slack/Zendesk. Pas de Chrome extension ni mobile.

---

## 6. Métriques & Résultats Clients

| Metric | Rox | Elevay |
|--------|-----|--------|
| Time saved per rep | 8h/week | Non mesuré |
| Customer engagement increase | 35% | Non mesuré |
| ARR close improvement | 2.5x pour SAMs | Non mesuré |
| Deployment time | 45 jours | Minutes (self-serve) |
| ROI guarantee | 2x ROI en 90 jours ou cancel | Non |
| Adoption rate | 90%+ across 250+ reps | N/A (solo founders) |

---

## 7. Forces & Faiblesses de Rox (pour informer Elevay)

### Forces de Rox
1. **Agent-per-account model** — chaque compte a son propre agent dédié qui accumule du contexte
2. **Warehouse-native** — les données restent chez le client, pas de vendor lock-in
3. **Conversation intelligence intégrée** — recording + transcription + insights + follow-up dans un seul produit
4. **Command interface** — orchestration multi-step en une seule commande NL
5. **Plays system** — encode les meilleures pratiques en templates exécutables
6. **Native apps** — mobile, desktop, Chrome extension
7. **Enterprise credibility** — Ramp, NVIDIA, MongoDB comme clients
8. **Team pedigree** — ex-Apple, Amazon, Confluent, Stanford PhD

### Faiblesses de Rox
1. **Enterprise-only positioning** — $1.2B valuation mais cible uniquement Global 2000, pas SMB
2. **Pricing opaque** — pas de self-serve pricing clair au-delà du starter
3. **45 jours de déploiement** — vs minutes pour un outil self-serve
4. **Pas de TAM building** — pas d'Apollo-like prospect database intégrée
5. **Dépendance aux intégrations** — nécessite Salesforce/HubSpot comme backend CRM
6. **Pas d'email sending** — orchestre l'outbound mais envoie via les outils existants
7. **$8M ARR pour $1.2B valuation** — 150x revenue multiple, risque de correction

### Ce que Rox fait que Elevay ne fait pas
1. **Org chart automatique** par compte
2. **Monitoring continu** de news/signaux (pas juste weekly)
3. **Auto-fill deal fields** depuis les conversations
4. **Chrome extension** pour enrichir depuis LinkedIn/le web
5. **Mobile app** iOS
6. **Agent-to-agent workflows** cross-départements
7. **Data lineage & provenance** — traçabilité de chaque donnée
8. **Plays builder UI** — créer des playbooks exécutables

### Ce que Elevay fait que Rox ne fait pas
1. **TAM building** — construction automatique du marché adressable via Apollo
2. **Scoring ICP natif** — score fit + engagement avec raisons
3. **Self-serve onboarding** — opérationnel en minutes, pas 45 jours
4. **Founder-first design** — UX pour une personne seule, pas une équipe de 250
5. **Autonomous pipeline** — l'agent décide ET exécute (pas juste recommande)
6. **Daily founder coaching** — pattern detection + priorities pour solo founders
7. **Email warmup** — gestion complète de la délivrabilité
8. **Context graph bi-temporel** — knowledge graph avec historique temporel des faits
9. **Self-improving flywheel** — les agents s'améliorent automatiquement via evals

---

## 8. Implications Stratégiques pour Elevay

### 8.1 Ce qu'il NE FAUT PAS copier
- L'architecture warehouse-native (over-engineering pour notre cible SMB)
- Le modèle agent-per-account (notre cible a 10-50 comptes, pas 10,000)
- Les intégrations Salesforce/HubSpot (nos users n'ont PAS de CRM existant)
- Le déploiement 45 jours (antithétique à notre valeur)
- Le pricing action-based (confusant pour des founders)

### 8.2 Ce qu'il FAUT copier (priorisé)

| Priorité | Feature Rox | Adaptation Elevay | Effort |
|----------|------------|-------------------|--------|
| **P1** | Command multi-step orchestration | Le chat chaîne les actions automatiquement au lieu de demander confirmation à chaque step | M (3-4j) |
| **P2** | Auto-fill deal fields from conversations | Le `enrichment-email-extract` met à jour les champs du deal automatiquement | S (1-2j) |
| **P3** | Plays builder UI | Page `/settings/plays` pour créer/éditer les `customSkillTemplates` | M (3-4j) |
| **P4** | Continuous signal monitoring | Passer les signal scans de weekly à daily ou event-driven | S (1j) |
| **P5** | Org chart per account | Construire l'organigramme depuis Apollo + context graph | M (3-4j) |
| **P6** | Chrome extension | Extension basique pour enrichir un profil LinkedIn dans Elevay | L (1-2 sem) |
| **P7** | Mobile app | PWA ou React Native lite | L (2-4 sem) |

### 8.3 Différenciation à renforcer
1. **Autonomie complète** — Rox recommande, Elevay exécute. Pousser le D2 (autonomous pipeline) comme différenciateur #1
2. **Zero-config** — Rox met 45 jours à déployer. Elevay est opérationnel en 5 minutes. Mettre ça en avant dans le marketing
3. **Founder-first** — Rox cible des équipes de 250+ reps. Elevay est l'agent pour le founder seul. Pas le même marché
4. **All-in-one** — Rox se branche sur Salesforce. Elevay REMPLACE Salesforce. Moins d'outils, moins de friction

---

## 9. Résumé Exécutif

**Rox est un concurrent enterprise sérieux ($1.2B, Sequoia/GC) mais PAS un concurrent direct d'Elevay.** Ils ciblent des équipes de 250+ reps dans des entreprises $100M+. Elevay cible des founders solo faisant du founder-led sales.

**Les features à prendre de Rox :**
- Multi-step command orchestration (le chat qui enchaîne les actions)
- Auto-fill deal fields depuis les conversations
- Plays builder UI pour encoder le process de vente
- Signal monitoring continu (pas juste weekly)

**Les features à ignorer :**
- Warehouse-native (over-engineering)
- Agent-per-account (pas notre scale)
- Intégrations Salesforce/HubSpot (nos users n'en ont pas)
- Native apps (prématuré pour notre stage)

**Le moat d'Elevay vs Rox :** Elevay est l'anti-Rox comme Rox est l'anti-Salesforce. Rox remplace les outils fragmentés pour les grandes équipes. Elevay remplace le BESOIN d'une grande équipe pour un founder seul.
