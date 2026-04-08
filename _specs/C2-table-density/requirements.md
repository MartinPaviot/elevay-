# C2: Table Density + Score Circles

## User Story
As a founder reviewing my accounts, I want dense, information-rich tables with visually impactful score displays so I can scan more data faster and instantly spot hot prospects.

## Acceptance Criteria

### Scenario: Table rows are 36px
GIVEN the accounts table is rendered
WHEN I measure the row height
THEN each data row is approximately 36px (down from 44px)
AND more accounts are visible without scrolling

### Scenario: Score display with colored circle
GIVEN a company has a score of 85 (grade A, Burning)
WHEN the score is displayed in the table
THEN the grade "A" appears inside a 22px green circle
AND the fire emoji and "Burning" label are next to it in green (not gray)

### Scenario: Score circle colors match heat level
- A/A+ (Burning): success/green circle
- B (Warm): warning/orange circle
- C (Cool): info/blue circle
- D/F (Cold): gray circle

## Edge Cases
- Score is null → show "—" (no circle)
- Very long company names don't overflow with tighter padding
- Mobile layout still works with reduced padding
