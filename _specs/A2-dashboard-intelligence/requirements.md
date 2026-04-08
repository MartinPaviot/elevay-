# A2: Dashboard Intelligence — Requirements

## User Story
As a founder who just completed onboarding and built a TAM, I want the dashboard to show meaningful stats about my pipeline so that I immediately see value and know what to do next.

## Acceptance Criteria

### Scenario: New user with TAM but no campaigns
GIVEN a user has 30 accounts (from TAM build) and 0 sequences launched
WHEN they view the dashboard
THEN the weekly summary shows founder stats: "{N} accounts | {N} contacts | ${X} pipeline | {N} deals"
AND NOT the outbound stats (0 sequences, 0 responses, 0 meetings, 0 closed)

### Scenario: Active user with campaign data
GIVEN a user has launched sequences and received responses
WHEN they view the dashboard
THEN the weekly summary shows outbound stats: "{N} sequences | {N} responses | {N} meetings | {N} closed"

### Scenario: Deals at risk displayed
GIVEN a user has 2 deals that haven't been updated in 7+ days
WHEN they view the dashboard
THEN a "Deals at risk" section shows each deal with name, value, and days silent
AND each card is clickable (routes to /opportunities/{id})

### Scenario: Contextual empty state for actions
GIVEN a user has accounts but no actions generated
WHEN the actions section would show "No actions right now"
THEN instead show contextual CTA based on CRM state:
  - Has accounts, no contacts: "Enrich your {N} accounts to discover contacts"
  - Has contacts, no emails sent: "You have {N} contacts ready for outreach"
  - Has deals at risk: "You have {N} deals at risk"
  - Fallback: "Ask the AI for suggestions"

## Edge Cases
- founderMetrics API returns null/error → fallback to current behavior
- All founder stats are 0 (brand new user, no TAM) → show default greeting, no stats card
- dealsAtRisk is empty → don't render the section
- Mixed state: some outbound stats > 0 AND founder stats > 0 → show outbound stats (active user)
