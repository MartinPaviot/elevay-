# F005 — Learned Trust Model: Design

## System Fit

The trust model sits between F003 (outcomes) and the approval mode guardrail.
It reads outcome data and user approval patterns to adjust thresholds
dynamically per tenant.

```
[Outcome Resolved F003] ──→ [Trust Adjuster] ──→ [Effective Thresholds]
[User Approve/Dismiss]  ──→ [Trust Adjuster] ──→ [Effective Thresholds]
                                                        │
                                                        ▼
                                               [enforceAgentApprovalMode]
```

## Data Model

Uses the existing `trust_events` table for raw events and tenant settings
for persisted thresholds. No new table needed.

### Tenant Settings Extension

```typescript
interface TenantSettings {
  // ... existing fields ...
  learnedThresholds?: Record<string, number>; // action_type → threshold
  trustStats?: {
    lastUpdated: string;
    outcomesByAction: Record<string, { positive: number; total: number }>;
    approvalsByAction: Record<string, { approved: number; total: number }>;
  };
}
```

## Threshold Adjustment Logic

```typescript
function computeEffectiveThreshold(
  baseThreshold: number,
  outcomes: { positive: number; total: number },
  approvals: { approved: number; total: number },
): number {
  let threshold = baseThreshold;

  // Outcome-based adjustment (requires 10+ data points)
  if (outcomes.total >= 10) {
    const successRate = outcomes.positive / outcomes.total;
    if (successRate >= 0.8) threshold -= 0.05;
    else if (successRate < 0.5) threshold += 0.05;
  }

  // Approval-based adjustment (requires 20+ data points)
  if (approvals.total >= 20) {
    const approveRate = approvals.approved / approvals.total;
    if (approveRate >= 0.9) threshold -= 0.05;
    else if (approveRate < 0.5) threshold += 0.05;
  }

  // Clamp
  return Math.max(0.5, Math.min(1.0, threshold));
}
```

## Integration with Approval Mode

Modify `enforceAgentApprovalMode()` to accept optional `learnedThresholds`
that override `HIGH_CONFIDENCE_THRESHOLDS` when available.

## Cron: Weekly Threshold Recalculation

Inngest cron runs weekly, queries `action_outcomes` and `trust_events`,
recomputes thresholds per tenant, writes to tenant settings.
