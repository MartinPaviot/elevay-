# Lightfield Settings Deep Dive

**Date**: 2026-04-01
**URL**: https://crm.lightfield.app/crm/settings

## S1: Settings Navigation — Complete Tab/Section Map

Settings has a left sidebar with two major sections:

### Account (personal)
1. **Settings** (Profile) — `/crm/settings/profile`
2. **Mail and Calendar** — `/crm/settings/mail-and-calendar`
3. **Notifications** — `/crm/settings/notifications`
4. **Recording** — `/crm/settings/recording`
5. **Agent** — `/crm/settings/agent`
6. **Connectors** — `/crm/settings/connectors`

### Workspace (organization)
7. **General** — `/crm/settings/organization`
8. **Members** — `/crm/settings/members`
9. **Meetings** — `/crm/settings/meetings`
10. **Knowledge** — `/crm/settings/knowledge`
11. **Data model** — `/crm/settings/data-model`
12. **Opportunity stages** — `/crm/settings/opportunities`
13. **Tasks** — `/crm/settings/tasks`
14. **Workflows** — `/crm/settings/workflows` (Beta badge)
15. **Import history** — `/crm/settings/import-history`
16. **Billing** — `/crm/settings/billing-redirect` (external link icon)
17. **Integrations** — `/crm/settings/integrations`
18. **API keys** — `/crm/settings/api-keys` (Beta badge)

**Total: 18 settings sections** across 2 categories.

Notable: "Workflows" and "API keys" are marked Beta. Billing has an external link icon (redirects to billing provider).

---

## S2: Section-by-section deep dive

### 1. Profile (Settings > Account > Settings)
**Screenshot**: settings-002-settings-landing.png

**Page title**: "Profile"
**Subtitle**: "Manage settings for your personal profile."

**Fields**:
- **First name**: text input, value="Martin"
- **Last name**: text input, value="Paviot"
- **Email**: text input, DISABLED, value="lf-signup@elevay.dev" — cannot change email from settings
- **Language**: dropdown, current="Français" — controls UI language
- **Timezone**: dropdown, current="(undefined) America/Tijuana" — note the "(undefined)" prefix, appears to be a display bug

**Buttons**:
- **Update**: disabled until changes are made

**Observations**:
- No avatar upload
- No role display
- No password change (likely OAuth-only)
- Language setting is per-user, not workspace
- Timezone is per-user
