# A3: Onboarding → Dashboard Transition

## User Story
As a founder who just completed onboarding, I want a smooth transition to the dashboard that shows me what was built and what to do next, so I don't feel lost.

## Acceptance Criteria

### Scenario: First-time dashboard after onboarding
GIVEN a user just completed onboarding (TAM built, accounts created)
WHEN they click "Go to your dashboard"
THEN the dashboard shows a welcome banner with personalized stats and 3 CTAs
AND the banner disappears after any CTA is clicked (persisted in localStorage)

### Scenario: Returning user (not first time)
GIVEN a user who already completed onboarding previously
WHEN they visit the dashboard
THEN no welcome banner is shown

## Edge Cases
- founderMetrics not loaded yet when banner renders → show generic welcome
- User refreshes the page → banner still shows until dismissed
- User clears localStorage → banner reappears (acceptable)
