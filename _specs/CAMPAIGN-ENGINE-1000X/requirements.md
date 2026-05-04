# Campaign Engine 1000x — Requirements

## Feature ID: CAMPAIGN-ENGINE-1000X (Phase 1)

## Overview

Replace the batch campaign wizard with an intelligent outreach engine that:
1. Builds a deep intelligence brief per prospect (replaces `buildProspectContext`)
2. Selects the optimal outreach strategy from a repertoire of 10 playbooks
3. Lets the user configure their autonomy level with granular guardrails and visible trust progression

---

## User Story 1: Intelligence Brief

**As a** founder doing outbound,
**I want** the system to automatically research each prospect before reaching out,
**So that** every email is informed by real context (not just name/company template fill).

### Acceptance Criteria

#### AC-1.1: Brief generation from company domain

```
GIVEN a company with a valid domain in the TAM
WHEN the system prepares outreach for a contact at that company
THEN it generates an IntelligenceBrief containing:
  - websiteSummary (1-3 sentence company description from their site)
  - recentNews (0-5 news items from last 90 days)
  - jobPostings (0-10 open roles scraped from careers page)
  - techStack (0-20 detected technologies)
  - competitorDetected (null or competitor name)
  - painPoints (1-5 inferred pain points)
  - bestAngle (1 sentence: the best approach angle)
  - publicContentDepth (integer: how many citable pieces of public content exist)
AND the brief is stored in the `intelligence_briefs` table
AND the brief has an `expiresAt` timestamp of 14 days from generation
```

#### AC-1.2: Parallel source fetching with soft-fail

```
GIVEN a brief generation request
WHEN one or more data sources fail (timeout, 403, rate limit)
THEN the brief is still generated from the remaining successful sources
AND the failed sources are logged with reason
AND the brief includes a `sourcesAttempted` / `sourcesSucceeded` count
AND no exception propagates to the caller
```

#### AC-1.3: Cache hit avoids re-research

```
GIVEN a brief exists for a company+contact pair
AND the brief's expiresAt is in the future
WHEN the system needs the brief again
THEN it returns the cached brief without re-fetching sources
AND no external HTTP calls are made
```

#### AC-1.4: Force refresh when signal fires

```
GIVEN a cached brief exists for a company
WHEN a new signal is detected for that company (e.g. funding_recent fires)
THEN the brief is marked as expired
AND the next access triggers a fresh research cycle
```

#### AC-1.5: LinkedIn activity enrichment (when URL available)

```
GIVEN a contact has a linkedinUrl in their profile
WHEN the brief is generated
THEN it includes linkedinActivity:
  - postsPerWeek (estimated from public feed)
  - recentTopics (top 3 themes from last 5 posts)
  - tone (formal/casual/technical/thought-leader)
AND this data is used by the Strategy Selector to determine if Social-First is viable
```

### Edge Cases

- Domain returns 403/Cloudflare challenge → skip website source, mark `websiteSummary: null`
- Company has no careers page → `jobPostings: []`, not an error
- Contact has no LinkedIn URL → `linkedinActivity: null`, Social-First strategy won't activate
- Rate limit hit on news API → use cached results if <7 days old, else empty
- LLM timeout during synthesis → return partial brief from raw sources without LLM summary

---

## User Story 2: Strategy Selector

**As a** founder doing outbound,
**I want** the system to automatically pick the best outreach strategy for each prospect,
**So that** I don't have to manually decide between cold email, warm intro, social-first, etc.

### Acceptance Criteria

#### AC-2.1: Deterministic scoring returns ranked strategies

```
GIVEN a prospect with an IntelligenceBrief, warm path data, active signals, and competitor detection
WHEN the Strategy Selector is invoked
THEN it returns a ranked list of 1-3 candidate strategies
AND each candidate has: strategyId, score (0-100), reason (human-readable)
AND the ranking is deterministic (same inputs → same output)
AND no LLM call is made for the ranking itself
```

#### AC-2.2: Warm Intro prioritized when available

```
GIVEN a prospect has a warm path with distance ≤ 2
AND the connector has been active (email/activity in last 90 days)
WHEN the Strategy Selector runs
THEN "warm_intro" strategy scores ≥ 90
AND it ranks first unless an Event-Triggered signal (inbound visit) exists
```

#### AC-2.3: Trigger-Based activates on fresh signals

```
GIVEN a prospect's company has a signal detected < 48 hours ago
AND the signal confidence is "high"
WHEN the Strategy Selector runs
THEN "trigger_based" strategy scores ≥ 85
AND the activating signal type is included in the reason
```

#### AC-2.4: Fallback to Long Game

```
GIVEN a prospect with:
  - No warm path
  - No fresh signals
  - publicContentDepth < 2 (can't do SMYKM)
  - No competitor detected
  - LinkedIn activity < 1 post/week (can't do Social-First)
WHEN the Strategy Selector runs
THEN "long_game" is the top (or only) strategy returned
AND reason explains why other strategies weren't viable
```

#### AC-2.5: Social-First requires LinkedIn activity

```
GIVEN a prospect with linkedinActivity.postsPerWeek >= 2
AND publicContentDepth >= 2
WHEN the Strategy Selector runs
THEN "social_first" strategy is included in candidates with score ≥ 70
```

#### AC-2.6: Multi-Thread activates for high-value targets

```
GIVEN a company with score >= 85
AND contactsAvailable >= 3 (multiple personas identified)
AND tenant has configured a deal value threshold
WHEN the Strategy Selector runs
THEN "multi_thread" strategy is included in candidates
AND reason includes the contact count and company score
```

#### AC-2.7: Re-engagement for dormant prospects

```
GIVEN a prospect with a previous outreach that ended in "not_now"
AND daysSince(previousOutreach.date) >= 60
WHEN the Strategy Selector runs
THEN "re_engagement" strategy is included in candidates
AND reason includes the time elapsed and previous outcome
```

### Edge Cases

- Two strategies tie (< 5 points difference) → return both, let Decision Engine (future) pick
- Prospect was previously contacted with strategy X that failed → penalize that strategy -20 points
- All strategies score < 40 → return only "long_game" with explicit "no strong signal" reason
- Contact has opted out of a channel → exclude strategies that require that channel

---

## User Story 3: Autonomy Configuration

**As a** founder setting up my outreach engine,
**I want** to choose how much autonomy the system has (from full manual to full auto),
**So that** I stay in control while gradually letting the system prove itself.

### Acceptance Criteria

#### AC-3.1: Four autonomy levels with clear defaults

```
GIVEN a new tenant completing onboarding
WHEN they reach the campaign engine setup
THEN autonomy level defaults to "copilot"
AND the UI explains what each level means:
  - Copilot: "I approve everything before it sends"
  - Guided: "Auto-send cold emails after 2h, ask me for replies & intros"
  - Autonomous: "Handle everything, escalate edge cases"
  - Strategic: "Also decide who to target and when"
AND each level shows a clear list of what's auto vs. what requires approval
```

#### AC-3.2: Granular permission overrides

```
GIVEN a user at any autonomy level
WHEN they open Settings > Autonomy
THEN they can override individual permissions:
  - coldEmailSend: manual | delayed (Xh) | auto
  - replyPositive: manual | delayed | auto
  - replyObjection: manual | delayed | auto
  - warmIntroSend: manual | auto_if_preapproved
  - newProspectAdd: manual | auto_if_icp_match
AND overrides take precedence over the level defaults
AND the UI clearly shows which permissions differ from the level default
```

#### AC-3.3: Guardrails apply at all levels

```
GIVEN a user has configured guardrails:
  - maxEmailsPerDay: 40
  - maxNewProspectsPerWeek: 25
  - neverContact: ["competitor.com", "existing-customer.com"]
  - alwaysEscalateWhen: deal_value > 10000
WHEN the system attempts an action that violates a guardrail
THEN the action is BLOCKED (not just flagged)
AND the user is notified with the specific guardrail that triggered
AND the action is logged with status "blocked_by_guardrail"
```

#### AC-3.4: Trust score visible and explained

```
GIVEN the system has been operating for > 3 days
WHEN the user views Settings > Autonomy
THEN they see a trust score (0-100) with trend indicator (rising/stable/falling)
AND a breakdown: "Based on: 34 actions, 94% approved without edits"
AND if score > 80 for 2+ weeks: a suggestion to upgrade autonomy level
AND if score < 40: a notification that autonomy was auto-reduced
```

#### AC-3.5: Auto-downgrade on trust drop

```
GIVEN the user is at Autonomous level
AND trust score drops below 40 (due to rejections, errors, negative replies)
WHEN the threshold is crossed
THEN autonomy is automatically reduced to Guided
AND the user receives a notification explaining:
  - What happened (specific errors listed)
  - What changed (which permissions reverted)
  - How to regain the level (approval threshold)
AND the user can override: "Keep Autonomous — I'll monitor"
```

#### AC-3.6: Delayed send with cancel window

```
GIVEN the user is at Guided level (or has coldEmailSend: "delayed")
AND delay is set to 2 hours
WHEN the system generates and schedules an email
THEN the email appears in the "Outgoing" queue with a countdown timer
AND the user can: Preview, Edit, Cancel, or Send Now
AND if the timer expires without user action → email sends automatically
AND if the user cancels → email moves to "Cancelled" and is not retried
```

#### AC-3.7: Escalation rules are configurable

```
GIVEN a user configuring their autonomy
WHEN they add an escalation rule (e.g. "always escalate when reply mentions competitor")
THEN the rule is saved and immediately active
AND it applies regardless of autonomy level
AND when triggered, the action goes to the approval queue with the rule name shown
```

### Edge Cases

- User sets maxEmailsPerDay to 0 → system pauses all outbound, shows warning
- User at Copilot level approves 50 actions in a row → suggest upgrade, don't auto-upgrade
- Trust score calculation: minimum 10 actions before score is computed (shows "building trust" before that)
- User downgrades manually from Autonomous to Copilot → trust score preserved, not reset
- Conflicting guardrails (e.g. maxEmails=40 but 50 prospects are "urgent signal") → guardrail wins, excess queued for tomorrow

---

## Non-Functional Requirements

- Intelligence Brief generation must complete in < 45 seconds (P95)
- Strategy Selector must return in < 100ms (pure computation, no I/O)
- Autonomy config changes take effect immediately (no restart/redeploy)
- All decisions are logged with full reasoning for audit/debug
- Brief data is tenant-isolated (no cross-tenant data leak)
