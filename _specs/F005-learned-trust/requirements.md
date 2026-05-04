# F005 — Learned Trust Model

## User Story

As the system, I want approval thresholds to evolve based on outcomes and
user behavior — so that the agent earns autonomy progressively rather than
operating on static confidence thresholds forever.

## Acceptance Criteria

### AC-1: Outcome-based threshold adjustment

GIVEN the outcome tracker (F003) resolves outcomes
WHEN the system has 10+ outcomes for an action type
THEN the effective threshold for that action type adjusts:
  - If 80%+ outcomes are positive → lower threshold by 0.05 (more autonomous)
  - If <50% outcomes are positive → raise threshold by 0.05 (more cautious)
  - Threshold floor: 0.5 (never fully blind trust)
  - Threshold ceiling: 1.0 (never fully locked out)

### AC-2: User approval/dismiss tracking

GIVEN the user approves or dismisses a proposed agent action
WHEN the decision is recorded
THEN the trust model records:
  - Action type
  - Was it approved or dismissed?
  - User's edit distance (did they modify the action before approving?)
AND if 90%+ of last 20 proposals for an action type were approved without edit
THEN threshold decreases by 0.05

### AC-3: Effective thresholds are tenant-specific

GIVEN each tenant has different behavior patterns
THEN trust thresholds are stored per-tenant, not global
AND they start at the default HIGH_CONFIDENCE_THRESHOLDS values
AND they diverge as the tenant's agent earns trust

### AC-4: Trust dashboard visibility

GIVEN the trust model adjusts thresholds
WHEN the user checks agent settings
THEN they can see current effective thresholds per action type
AND the trend (improving/declining)
AND the data behind it (approve rate, outcome rate)
