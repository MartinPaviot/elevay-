# F3.4: ML Scoring — Requirements

## User Story
As a founder, I want each account scored so I can focus on the highest-priority prospects first.

## Acceptance Criteria

### AC1: Score accounts after enrichment
GIVEN enriched accounts with industry, size, revenue
WHEN scoring runs
THEN each account gets a score 0-100 with explanation

### AC2: Score visible on accounts page
GIVEN scored accounts
WHEN viewing the Accounts page
THEN scores appear as a sortable column

### AC3: Scoring via chat
GIVEN the chat
WHEN I say "score my accounts"
THEN the AI scores and explains the ranking
