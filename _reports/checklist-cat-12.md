# Category 12: Integrations Audit

**Audited**: 2026-04-01
**Updated**: 2026-04-01
**Status**: PARTIALLY FIXED

---

## Item-by-item audit

### 12.1 Google OAuth: connect Google account
**Status**: ✅ WORKING

### 12.2 Gmail sync: emails captured and attached to right contacts/accounts
**Status**: ✅ WORKING

### 12.3 Google Calendar sync: meetings captured
**Status**: ✅ WORKING (F2.2 already implemented)

### 12.4 Microsoft OAuth: connect Outlook
**Status**: 🟡 BLOCKED — Martin must register Azure app

**Evidence**: Microsoft blocked automated account creation. Spec and integration plan documented in `_specs/G28/requirements.md`.

### 12.5 CSV import: various formats, encodings, edge cases
**Status**: ✅ WORKING

### 12.6 CSV export: clean, complete files
**Status**: ✅ IMPLEMENTED

**Evidence**: `/api/export?entity=contacts&format=csv` supports per-entity CSV export with proper escaping.

### 12.7 Webhook/API for external integrations
**Status**: 🟡 PARTIAL — session auth only

### 12.8 Slack integration: notifications
**Status**: 🟡 BLOCKED — reCAPTCHA blocks automated Slack app creation

**Evidence**: Notification system built with email + in-app channels. Slack documented as integration point in G32 spec.

### 12.9 CRM migration from HubSpot
**Status**: ❌ NOT IMPLEMENTED (flagged as ocean)

### 12.10 CRM migration from Salesforce
**Status**: ❌ NOT IMPLEMENTED (flagged as ocean)

### 12.11 CRM migration from Apollo
**Status**: ❌ NOT IMPLEMENTED

---

## Score: 5/11 items passing
- ✅: 5 (Google OAuth, Gmail sync, Calendar sync, CSV import, CSV export)
- 🟡: 3 (Microsoft OAuth blocked, Webhook API partial, Slack blocked)
- ❌: 3 (HubSpot, Salesforce, Apollo migrations — flagged as oceans)
