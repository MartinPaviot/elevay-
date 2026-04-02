# Category 12: Integrations Audit

**Audited**: 2026-04-01
**Status**: COMPLETE

---

## Item-by-item audit

### 12.1 Google OAuth: connect Google account
**Status**: ✅ WORKING

**Evidence**: `auth.ts` lines 20-35: Google provider with `openid email profile gmail.readonly calendar.readonly` scopes. `access_type: "offline"` for refresh tokens. Tokens stored in `authAccounts` table via DrizzleAdapter.

### 12.2 Gmail sync: emails captured and attached to right contacts/accounts
**Status**: ✅ WORKING

**Evidence**:
- `lib/gmail.ts`: `getGmailClient()` + `fetchRecentEmails()` — real Google API calls
- `app/api/email/sync/route.ts`: Deduplicates by gmailMessageId, creates activity records
- Links emails to contacts by matching email addresses
- Direction detection (inbound/outbound)
- **Limitation**: Manual trigger only, no auto-background sync. Headers + snippet only (no body).

### 12.3 Google Calendar sync: meetings captured
**Status**: ✅ WORKING

**Evidence**:
- `lib/calendar.ts`: `getCalendarClient()` + `fetchRecentMeetings()` — real Google Calendar API
- `app/api/calendar/sync/route.ts`: Syncs meetings to activities, matches attendees to contacts
- Deduplicates by calendarEventId
- Extracts: meeting ID, title, description, attendees, location, meeting links

### 12.4 Microsoft OAuth: connect Outlook
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No Microsoft provider in NextAuth config. No Microsoft Graph SDK in dependencies. `connectedMailboxes` schema has `provider: "outlook"` as comment but no wiring.

**Effort**: Build G28 feature — ~4h

### 12.5 CSV import: various formats, encodings, edge cases
**Status**: ✅ WORKING

**Evidence**:
- `app/api/import/route.ts`: PapaParse with flexible column matching
- Supports: email, firstname, lastname, company, title, phone, linkedin, notes
- Case-insensitive, underscore/space/dash tolerant header matching
- 10,000 row limit
- Auto-creates/matches companies
- **Issue**: No explicit encoding handling (assumes UTF-8)

### 12.6 CSV export: clean, complete files
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No export endpoints found. No download functionality anywhere.

**Effort**: Build export API + UI button. ~2h

### 12.7 Webhook/API for external integrations
**Status**: ❌ PARTIAL

**Evidence**: REST API endpoints exist but are session-based only. No API key authentication for external access. No webhook sending to external systems. No API documentation.

**Effort**: Add API key auth + docs. ~3h

### 12.8 Slack integration: notifications
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No Slack SDK in dependencies. No Slack webhook code. No Slack OAuth provider.

**Effort**: Build G32 feature (Slack part). ~2h

### 12.9 CRM migration from HubSpot
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No HubSpot API integration. No import mapping for HubSpot format.

**Effort**: ~8h (ocean — flag for later)

### 12.10 CRM migration from Salesforce
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No Salesforce API integration.

**Effort**: ~8h (ocean — flag for later)

### 12.11 CRM migration from Apollo
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: Apollo is used for enrichment only, not for importing contacts/lists/sequences.

**Effort**: ~4h (could leverage existing Apollo integration)

---

## Score: 3/11 items passing
- ✅: 3 (Google OAuth, Gmail sync, Calendar sync + CSV import = 4 actually)
- ❌: 7

Correction: 4/11 items passing (CSV import also works).
