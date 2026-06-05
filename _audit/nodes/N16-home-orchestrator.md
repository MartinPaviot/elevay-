# N16 — `/` → `/home` (Up next / Home — ORCHESTRATEUR) + onboarding réel

Preuves : `screenshots/001-home-n16-lowdata.png` (dashboard "Up next"), `screenshots/029-home-N16-full.png` (carte onboarding).

## Réconciliation onboarding (mémoire vs code mort)
Le **vrai onboarding** = **carte de confirmation single-screen** (`components/onboarding-confirmation-card.tsx` — fichier en cours d'édition par Martin, cf. git status `M`), rendue sur `/home`. **PAS** le wizard 7-phases `/onboarding-v3` (= **code mort** audité par erreur par l'agent entry-funnel en statique).
→ Correction baseline : le bug "Phase 1 ICP droppé dans onboarding_progress" de `entry-funnel.md` **ne s'applique pas** au vrai onboarding. Le wizard `/onboarding-v3` devrait être supprimé (dead code, route orpheline — voir C6).

La carte :
- "Here's what I picked up about you" : Your name (Martin Paviot), **Company** (E2E Test Workspace, badge **"AI · pilae.ch"**), **Company website** (pilae.ch, badge **"AI · your email"**), What you sell (vide), Email tone (Formal / **Direct** / Casual).
- "Who you're going after" (ICP) : Industries / Company sizes / Geographies / Seniorities / Departments (placeholders vides ici) + "The live count below reflects your current criteria" → **ICP→TAM live count câblé** (S2/E4 présent dans la card).
- **Design exemplaire** : conforme aux principes maison (infer over asking + **badge de source par champ** + live TAM count). C'est le meilleur écran vu de l'audit.

## Inconsistance (bug)
- **Même route `/home`, deux contenus différents selon le load** : 001 = dashboard "Up next / Welcome back / Your priorities today (Today's meetings, Hot contacts, Tasks due)" ; 029 = carte onboarding. À clarifier (flag onboarding-incomplete ? race d'hydratation ? ). Un user peut voir l'un ou l'autre → confusion.

## Orchestrateur (dashboard, vu en 001)
- "Your priorities today" : Today's meetings, **Hot contacts** (vide : "No hot contacts yet — they'll appear when activity picks up."), Tasks due.
- Statique : widgets Today's meetings/tasks **sans handlers/liens** (cul-de-sac) ; cartes de reco company/deal/campaign → pages liste **sans contexte/entityId** (S1).
- **Input chat embarqué** en bas ("e.g. Show my best prospects, Pipeline health, Draft email to…") = même endpoint `/api/chat` → **cassé (500)** comme N27.

## Gaps
- G-N16-1 [bug/UX] `/home` contenu nondéterministe (carte onboarding vs dashboard) sur la même route.
- G-N16-2 [S0] input chat du Home cassé (`/api/chat` 500, = C1/N27).
- G-N16-3 [S1/seam] widgets Today's meetings/tasks/hot-contacts sans lien (cul-de-sac) ; cartes reco → listes sans contexte (S1, statique).
- G-N16-4 [dead code] `/onboarding-v3` wizard = code mort (le vrai onboarding est la card) → supprimer.
- (+) carte onboarding = design exemplaire (infer + source badges + live count) — à préserver/étendre.
