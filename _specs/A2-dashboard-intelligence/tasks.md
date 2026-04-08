# A2: Dashboard Intelligence — Tasks

- [ ] Task 1: Add founderMetrics to DashboardSummary interface
  Verify: TypeScript compiles without errors
  Test: Type check passes

- [ ] Task 2: Conditional weekly summary — founder stats vs outbound stats
  Verify: When outbound stats are all 0 but totalAccounts > 0, show founder stats
  Test: Visual verification on dev server

- [ ] Task 3: Deals at risk section
  Verify: If dealsAtRisk has entries, they render as clickable cards with name/value/days
  Test: Visual verification

- [ ] Task 4: Contextual empty state for actions
  Verify: Empty state shows relevant CTA instead of "No actions right now"
  Test: Visual verification with different CRM states

- [ ] Task 5: Run test suite
  Verify: pnpm test passes (no regressions)
