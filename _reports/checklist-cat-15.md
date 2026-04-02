# Category 15: Legal & Compliance — Audit Report

**Date**: 2026-04-01
**Status**: ALL ❌

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Terms of Service written and linked | ❌ | No ToS page or content anywhere |
| 2 | Privacy Policy written and linked (GDPR-compliant) | ❌ | No Privacy Policy page or content |
| 3 | Cookie consent banner (if using cookies beyond auth) | ❌ | No cookie consent banner component |
| 4 | DPA available for enterprise customers | ❌ | No DPA document |
| 5 | GDPR: right to access, deletion, export — all implemented and tested | ❌ | No /api/gdpr/* endpoints |
| 6 | CAN-SPAM: unsubscribe works, physical address, honest subjects | ❌ | Partial: emailOptouts table exists, reply classification detects "unsubscribe". Missing: List-Unsubscribe header, physical address, unsubscribe link in emails |
| 7 | SOC 2 readiness: architecture supports future audit | ❌ | No structured logging, no access audit trail |
| 8 | Data encryption at rest (Supabase — verified) | 🟡 | Supabase encrypts at rest by default, but not explicitly verified/documented |
| 9 | Data encryption in transit (HTTPS — verified no HTTP) | ❌ | AUTH_URL is http://localhost:3002, no HTTPS config for production |
| 10 | Acceptable use policy for outbound features | ❌ | No AUP exists |
| 11 | Contact data provenance documented | ❌ | Not documented |

**Partial implementations found**:
- `emailOptouts` table (schema.ts:535-547) — stores opt-out emails with reason
- Reply classification in inngest/functions.ts detects "unsubscribe" replies
- Hard bounce webhook auto-adds to emailOptouts

**Missing entirely**: All legal pages, GDPR endpoints, consent checkbox on signup, footer links to legal pages, List-Unsubscribe headers, physical address in emails.
