# Category 2: Email Infrastructure Audit

**Audited**: 2026-04-01
**Status**: IN PROGRESS

## Summary

Email infrastructure has a solid data model but **critical gaps**: no actual sending implementation, no CAN-SPAM compliance, no unsubscribe mechanism, no Microsoft OAuth.

---

## Item-by-item audit

### 2.1 Email sending works end-to-end
**Status**: ❌ NOT WORKING

**Evidence**:
- `inngest/functions.ts` lines 211-419: `sendSequenceStep` queues emails but never sends them
- Sets `fromAddress: "pending@rotation"` (line 344) — placeholder
- Comment says "Will be set by send worker" — send worker doesn't exist
- `components/email-composer.tsx` line 28: Calls `/api/email/send` — endpoint doesn't exist
- No SMTP sending code anywhere in codebase

**Effort**: Build send worker using EmailEngine or direct SMTP. ~4h

### 2.2 Using REAL mailboxes (Google Workspace or Microsoft 365)
**Status**: ❌ NO SENDING CAPABILITY

**Evidence**: Mailbox registration exists (`app/api/settings/mailboxes/route.ts`) and supports Gmail OAuth + SMTP credentials. But without send worker, can't verify real mailbox sending.

### 2.3 SPF records configured correctly
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No SPF verification code. No domain health check.

### 2.4 DKIM records configured correctly
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No DKIM signing or verification code.

### 2.5 DMARC records configured correctly
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No DMARC verification code.

### 2.6 Domain warming TESTED
**Status**: ❌ UI ONLY — no actual warmup

**Evidence**:
- Schema has `warmupStartedAt`, `warmupDailyTarget` (default 5), `warmupCompletedAt`
- UI shows "Day X/21" progress
- "Skip Warmup" action sets dailyLimit to 50
- **No warmup email sending worker** — targets exist but nothing sends warmup emails
- No auto-graduation from warming_up → active

### 2.7 Mailbox rotation works
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: `connectedMailboxes` schema supports multiple mailboxes per tenant. But `outboundEmails` sets `fromAddress: "pending@rotation"` — no rotation algorithm exists.

### 2.8 Bounce handling
**Status**: ✅ WORKING (via EmailEngine webhook)

**Evidence**:
- `app/api/webhooks/emailengine/route.ts` lines 51-104: Handles `messageBounce`
- Hard bounces: auto-adds to `emailOptouts` table
- Records bounce type, message, timestamp
- Increments `bounceCount7d` on mailbox
- **Issue**: Hard bounce detection is simplistic (checks for "550" or "User unknown")

### 2.9 Unsubscribe link in every email
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No unsubscribe link generation. No List-Unsubscribe header. No unsubscribe endpoint.

### 2.10 Unsubscribe actually stops ALL sequences
**Status**: ❌ PARTIAL

**Evidence**:
- `inngest/functions.ts` lines 314-331: Checks `emailOptouts` before queueing — works
- Reply classification "unsubscribe" updates enrollment status
- **BUT**: Reply "unsubscribe" does NOT add to `emailOptouts` table — only stops current sequence, not future ones

### 2.11 Reply detection works (positive/negative/OOO/unsubscribe)
**Status**: ❌ PARTIAL — classification logic exists but isn't triggered

**Evidence**:
- `inngest/functions.ts` lines 421-479: `processReply` function classifies using LLM
- `webhooks/emailengine/route.ts`: Detects replies, updates outboundEmails
- **BUT**: Webhook doesn't trigger `processReply` Inngest function — classification never runs

### 2.12 Reply auto-stops sequence
**Status**: ❌ PARTIAL

**Evidence**: `processReply` sets enrollment status to "replied" — but `processReply` is never triggered (see 2.11).

### 2.13 Sending rate limits respected
**Status**: ❌ NOT ENFORCED

**Evidence**: Schema has `dailyLimit` and `sentToday` fields. No code checks these before sending. No rate limiting logic.

### 2.14 Spam complaint rate tracked
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No spam complaint tracking or alerting.

### 2.15 Email tracking (open/click) works
**Status**: ❌ STUBBED

**Evidence**: `outboundEmails` table has `openedAt` and `clickedAt` fields. No tracking pixel or click link rewriting implementation.

### 2.16 CAN-SPAM compliance
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No physical address in footer. No List-Unsubscribe header. No sender name validation.

### 2.17 GDPR compliance
**Status**: ❌ NOT IMPLEMENTED

**Evidence**: No consent tracking. No right-to-deletion flow. No data export for GDPR.

### 2.18 CASL compliance
**Status**: ❌ NOT IMPLEMENTED

### 2.19 REAL inbox placement test
**Status**: ❌ NOT POSSIBLE (no sending capability)

### 2.20 Domain reputation monitoring
**Status**: ❌ NOT IMPLEMENTED

### 2.21 Warm-up schedule documented and proven
**Status**: ❌ NOT IMPLEMENTED (see 2.6)

---

## Score: 1/21 items passing (bounce handling only)
- ✅: 1 (bounce handling)
- ❌: 20
