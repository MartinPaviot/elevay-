# Étape 12 — Settings (18 sous-pages) — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `/settings/layout.tsx` + 18 pages sous `/settings/*` (dont 1 redirect `mailboxes`).
**Méthode :** audit-deep `05-settings-all.md` (très complet) + captures Lightfield `settings-profile.png`, `settings-agent.png`, `settings-knowledge.png`.

---

## 0. État actuel — rappel + updates

### 0.1 Structure navigation Elevay
| Groupe | Pages |
|---|---|
| Account | Profile, Agent |
| Workspace | Custom Objects, Data Model, General, ICP & Product, Knowledge, Mail & Calendar, Members, Notifications, Opportunity Stages, Recording, Workflows |
| Developer | MCP Integration |
| Billing | Billing |
| Admin-only (BUGFIX-05 applied) | Evals (avec redirect /settings si non-admin), MCP (admin-gated) |

### 0.2 Structure Lightfield (depuis captures)
| Groupe | Pages |
|---|---|
| Account | Settings (Profile), Mail and Calendar, Notifications, Recording, Agent, Connectors |
| Workspace | General, Members, Meetings, Knowledge, Data model, Opportunity stages, Tasks |

### 0.3 Bugs BUGFIX-série résolus
- **Admin gate pages `/settings/evals` + `/settings/mcp`** → RÉSOLU par BUGFIX-05 (redirect si member, sidebar hide).
- **`/api/settings/mail-calendar` PUT savait pas persister** → RÉSOLU par BUGFIX-01.
- **Members invite flow complet** → implémenté par BUGFIX-02 (commit `bdcfe54`).
- **Workflows multi-action** → RÉSOLU par BUGFIX-03.

### 0.4 Bugs encore présents (per audit-05)
- **Knowledge : `id: "temp-" + Date.now()`** laissé en state si save échoue → topic UI "temp-" visible.
- **Data Model : options select non éditables après création**, no dupe validation.
- **Billing plans hardcoded**, pas d'historical usage, pas de factures.
- **ICP : no templates pré-faits**, no "Custom" AI tone.
- **Notifications : à vérifier scope.**

---

## 1. Exigences pixel-level — par page

### 1.1 Structure navigation (shared)
- **Sidebar settings** : sticky left, groupes avec heading uppercase.
- **Breadcrumb** : "Settings > Profile" dans le header.
- **Keyboard** : `G` puis `S` pour ouvrir settings (global shortcut).
- **Search settings** : input en haut de sidebar pour fuzzy-search across toutes les pages.
- **Ungrouping** : pages unrelated doivent bouger de groupe :
  - "Agent" → Workspace (not Account — c'est une feature tenant, pas profile).
  - "ICP & Product" → Workspace ✅ déjà.
- **Ajouter "Connectors" page dédiée** (Lightfield parité) : listing tous connectors (Gmail, Outlook, Slack, Zapier, webhook custom, etc.). Moves des connections OAuth hors de Mail & Calendar.

### 1.2 Profile (`/settings/page.tsx`)
- Validation frontend : trim whitespace, required fields.
- Upload photo avatar (S3/Cloudinary).
- "Reset password" link → `/forgot-password` (dépend de I3 étape 3).
- **Security section** : active sessions list (device, location, last used) + "Sign out all other devices".
- **2FA toggle** (dépend de I15 étape 3 v2).
- **Delete account** button (confirm typé "DELETE" + export data first).

### 1.3 Agent (`/settings/agent`)
Lightfield capture : simple "Record creation and updates → Ask every time" dropdown. **Très minimal.**
- **Exigence Elevay plus riche :**
  - Per-action approval : contact create / account create / deal create / sequence launch / task create → "Auto" | "Always ask" | "Never".
  - **Auto-approve threshold** : si confidence > X %, auto.
  - **Blocked actions** : list d'actions que l'agent ne doit jamais faire (ex: "Send email without preview").
  - **Tone preference** : link vers ICP page (déjà présent).
  - **Memory** : toggle "Remember my preferences" + list of learned prefs.

### 1.4 Mail & Calendar (`/settings/mail-calendar`)
Voir audit-05 détails. Gaps :
- **Multi-mailbox pooling** UI : déjà partiellement. Ajouter "Add sending mailbox" button avec DNS/DKIM check.
- **Warmup dashboard** dédié : historical data (sent volume ramp per day), warmup targets (100→500→2000 days).
- **Sync preferences per mailbox** (pas juste global) :
  - Backsync range override per mailbox.
  - Do-not-track list override per mailbox.
  - Signals extraction on/off per mailbox.
- **Deliverability score per mailbox** : color-coded (green/yellow/red) avec détail clickable.
- **Revoke OAuth** button (avec confirm).

### 1.5 Notifications (`/settings/notifications`)
À audit dédié (non inspecté en profondeur). Exigences génériques :
- Channels : in-app, email, Slack (v2), mobile push (v2).
- Per-event toggle : new reply, meeting joined by bot, deal stalled, campaign launched, invite accepted, etc.
- Digest settings : daily summary email (morning/evening), weekly report.
- Do-not-disturb hours (timezone-aware).
- Test notification button.

### 1.6 Recording (`/settings/recording`)
- **Default bot join** : on | off | ask.
- **Whitelist / blacklist** domains (ex: don't record if attendee from `@competitor.com`).
- **Language detection** : auto | specify list.
- **Retention** : keep recordings for N days.
- **Consent banner** content (personalizable).
- **Auto-delete after N days** post-transcript extraction.

### 1.7 Members (`/settings/members`)
BUGFIX-02 a implémenté invite flow. Exigences additions :
- **Role matrix** visible : admin / member / viewer + per-feature permissions.
- **Activity audit** per member : last login, activities count (last 30 days).
- **SSO / SAML** (v2 enterprise).
- **Invitation expiry** : default 7 days, admin can extend.
- **Resend invite** + **Revoke invite** buttons.
- **Transfer ownership** : if admin leaves, assign new admin.

### 1.8 Meetings (`/settings/meetings`)
Redirect to Recording OU séparé settings :
- Calendar source : Google / Microsoft.
- Default duration (15 / 30 / 45 / 60 min).
- Buffer time (no back-to-back).
- Booking page link (to share with prospects).

### 1.9 Knowledge (`/settings/knowledge`)
Lightfield capture : minimaliste "Topic + Content" card + "+ Add knowledge".

**Exigences Elevay :**
- Support multiple topics ✅ déjà.
- **Bug fix : "temp-" prefix** → create backend d'abord, THEN set real UUID.
- **Rich editor** (Markdown or WYSIWYG) pour Content.
- **Upload documents** : PDF, DOCX, Notion export, Drive docs → auto-extract text.
- **URL import** : paste URL → scrape + chunk + embed.
- **Vectorization status** per topic : "Indexed · 47 chunks".
- **Usage stats** : "Used in 23 AI responses last week".
- **Delete with impact warning** : "This topic is used in X sequences — removing will stop personalization".

### 1.10 Data Model (`/settings/data-model`)
- **Bug fix : options select editable** après création.
- **Bug fix : dupe name validation** inline.
- **AI descriptions** : each field can have "Description for AI" (helps LLM understand what the field means).
- **Field dependencies** : e.g., "If Industry = 'SaaS', show Pricing Model field".
- **Templates** : pre-made custom fields per persona (SaaS / eCommerce / Fintech / Marketplace).
- **Import schema** from HubSpot/Salesforce export.
- **Field deletion** with impact warning.

### 1.11 Opportunity Stages (`/settings/stages`)
- **Editable stages** (Add / rename / reorder / color).
- **Default stages template** (3 variants : standard / enterprise / SMB).
- **Probability per stage** (user override, default per stage).
- **Stage exit criteria** (checklist defining when a deal can advance) — advanced.
- **Migration** : if user deletes a stage, force pick a new stage for existing deals at that stage.

### 1.12 Workflows (`/settings/workflows`)
BUGFIX-03 a résolu multi-action. Exigences additions :
- **Template library** : pre-made workflows (e.g., "New deal → assign to closest match owner + create intro task + notify Slack").
- **Test run** : dry-run with sample event.
- **Execution history** : log des workflow runs, clickable for details.
- **Rate limit warning** : if workflow triggers >100x/hour.
- **Schedule triggers** (cron-like).

### 1.13 ICP & Product (`/settings/icp`)
- **Templates ICP** : 5 pre-made (YC founder / Enterprise SaaS / SMB B2B / Marketplace / DevTool).
- **"Custom" AI tone** : free-text description.
- **ICP history** : track changes (who/when/what). Critical for attribution.
- **Test ICP** : input a company domain → "This company is a 73% match for your ICP because…".

### 1.14 General / Workspace (`/settings/workspace`)
- Workspace name, logo, website.
- Default timezone (tenant-level, members can override).
- **Branding** : custom logo/colors on outbound emails (enterprise).
- **Delete workspace** (confirm typé).

### 1.15 Billing (`/settings/billing`)
- **Historical usage** chart (last 12 months).
- **Invoices / receipts** downloadable.
- **Plans dynamic** (fetched from Stripe Products API, not hardcoded).
- **Upgrade CTA** contextual : if hitting 80% usage → banner "Upgrade to Pro for unlimited".
- **Trial extension request** (self-serve or submit request).

### 1.16 Data Privacy (`/settings/privacy`)
(Existe audit : "Do not track" + backsync). Exigences :
- **Export all data** (GDPR Article 20) : JSON / CSV export complet du tenant.
- **Delete all data** (GDPR erasure) : confirm typed, backup first.
- **Data region** : EU / US selector (enterprise).
- **DPA download** (enterprise).
- **Third-party processors** list (Stripe, Resend, Apollo, Anthropic, OpenAI, etc.).

### 1.17 Custom Objects (`/settings/objects`)
- Admin-only (si l'entité custom est critique pour business logic).
- Create new entity type (e.g., "Partners", "Events", "Products").
- Define fields for that type.
- Wire to record linking system.

### 1.18 MCP Integration (`/settings/mcp`) — admin-only
(BUGFIX-05). Exigences additions :
- **Key usage stats** (requests per key).
- **Rate limit per key**.
- **Revoke key** with audit log.
- **MCP server URL + auth** display pour external tools.

### 1.19 Evals (`/settings/evals`) — admin-only
(BUGFIX-05). Exigences (audit-05 §4) :
- **Edit case** button.
- **Delete dataset/run**.
- **Grader model config UI** (which LLM judges).
- **Export run results** CSV.
- **Regression alerts** email si regression >5 %.

### 1.20 Connectors (NEW page — Lightfield parity)
- Liste de connectors : Gmail, Outlook, Slack, Zapier, webhook, Salesforce import, HubSpot import, LinkedIn, Zoom, Google Drive, Notion.
- Status per connector (Connected / Pending / Error).
- Connect / disconnect actions.
- Integration-specific settings.

---

## 2. Comparaison concurrents

### 2.1 Lightfield (3 captures)
**Forces :**
- Structure Account/Workspace claire (6+7 pages chacun).
- **Profile page** : minimaliste, language FR, timezone `(undefined) America/Tijuana` (**bug: shows "undefined" prefix**). Email read-only. Update button disabled quand pas de changement.
- **Agent page** : 1-option "Record creation and updates: Ask every time" dropdown. Minimalisme extrême.
- **Knowledge page** : Topic + Content + Save/Remove. "+ Add knowledge" top. Clair et linear.
- **Connectors** page dédiée (vu dans sidebar).

**Ce qu'on copie :**
- Connectors dédiée.
- Simplicité Agent page (permissions-focused).
- Structure globale propre.

**Ce qu'on ne copie pas :**
- Minimalisme extrême Knowledge (Elevay veut rich editor + vectorization).

### 2.2 Monaco
Pas de capture settings.

### 2.3 Gap synthèse
| Page | Elevay | Lightfield | Gap |
|---|---|---|---|
| Profile security (sessions, 2FA) | ❌ | ? | **HAUTE** |
| Avatar upload | ❌ | ? | MOYENNE |
| Connectors page dédiée | ❌ | ✅ | **HAUTE** |
| Knowledge rich editor + upload | ❌ | ⚠️ minimal | **HAUTE** |
| Data model dupe validation + editable options | ⚠️ bug | ? | HAUTE |
| Billing invoices + historical | ❌ | ? | HAUTE |
| GDPR export + delete all | ❌ | ? | **CRITIQUE** |
| ICP templates + test | ❌ | ❌ | HAUTE |
| Workflows templates + test run | ❌ | ❌ (probable) | HAUTE |
| Members role matrix + audit | ⚠️ invite OK | ? | HAUTE |
| Search settings (fuzzy) | ❌ | ❌ | MOYENNE |
| Knowledge temp- bug | ❌ | ❌ | BASSE |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) |
|---|---|---|---|
| N1 | GDPR export + delete all data (Privacy page) | **CRITIQUE** | 12 |
| N2 | Profile security (sessions list + sign out all) | **CRITIQUE** | 6 |
| N3 | Connectors page dédiée (Lightfield parity) | HAUTE | 10 |
| N4 | Knowledge rich editor + upload docs + vectorize indicator | HAUTE | 12 |
| N5 | Billing invoices + historical usage + dynamic plans | HAUTE | 8 |
| N6 | Data Model fix: editable options + dupe validation + AI descriptions | HAUTE | 6 |
| N7 | ICP templates 5 pre-made + test button | HAUTE | 6 |
| N8 | Workflows templates + test run + execution history | HAUTE | 10 |
| N9 | Members role matrix + audit log | HAUTE | 6 |
| N10 | Agent permissions per-action + auto-approve threshold | HAUTE | 5 |
| N11 | Notifications page complète (channels, per-event, digest) | HAUTE | 10 |
| N12 | Opportunity Stages editable + probability + migration | HAUTE | 6 |
| N13 | Recording advanced (whitelist, language, retention) | MOYENNE | 5 |
| N14 | Knowledge temp- bug fix | MOYENNE | 0.5 |
| N15 | Mail & Calendar: deliverability score + revoke OAuth | MOYENNE | 4 |
| N16 | Search settings fuzzy (command palette filter) | MOYENNE | 3 |
| N17 | Avatar upload | MOYENNE | 4 |
| N18 | Workspace delete + branding | MOYENNE | 4 |
| N19 | Data Model: field deps + templates + import schema | MOYENNE | 8 |
| N20 | Evals admin: edit case + delete + grader config + export | MOYENNE | 5 |
| N21 | MCP admin: key stats + rate limit | BASSE | 3 |
| N22 | 2FA + SSO enterprise | BASSE (v2) | 20 |

**Total v1 (N1-N12) :** ~97h · **v2 :** ~36h

---

## 4. Décisions à prendre

1. **GDPR export format :** JSON (complet) ou CSV (simple) ? → **JSON zip** (complet).
2. **Connectors page content :** Lightfield parity ou Elevay-specific list ? → **Lightfield parity + Elevay-specific (MCP, Zapier)**.
3. **Knowledge editor : Markdown or WYSIWYG ?** → **Markdown** (dev/founder audience).
4. **ICP test : match score via LLM call or static scoring ?** → **LLM call** (more accurate, <2s latency).
5. **Workflows templates : curated list or allow community ?** → **Curated v1**.
6. **Members role matrix : 3 roles fixed or customizable ?** → **3 roles v1** (admin/member/viewer).

---

## 5. Prochaines actions
1. Martin : décisions §4.
2. Sprint critique : N1+N2 (18h).
3. Sprint haute : N3+N4+N5+N6 (36h).
4. Sprint : N7+N8+N9+N10+N11+N12 (43h).
5. v2 : N13-N22.
