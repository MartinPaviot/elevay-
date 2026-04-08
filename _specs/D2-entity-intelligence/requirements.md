# D2: Entity Intelligence Brief

## User Story
As a founder viewing an account, I want to see an AI-generated intelligence brief that synthesizes context graph data, recent activities, and relationships so I can make informed decisions without asking the AI manually.

## Acceptance Criteria

### Scenario: Account with rich context
GIVEN an account with recent activities and connected contacts
WHEN I open the account detail page
THEN an intelligence brief (3 sentences) appears at the top
AND it references specific data points (dates, names, amounts)

### Scenario: Account with no data
GIVEN an account with no activities or contacts
WHEN I open the account detail page
THEN a fallback message appears: "Not enough data yet."

### Scenario: Brief is cached
GIVEN I viewed an account's intelligence brief 30 minutes ago
WHEN I view the account again
THEN the same cached brief loads instantly (no LLM call)
