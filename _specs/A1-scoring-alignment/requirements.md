# A1: Scoring Threshold Alignment + Audit

## User Story
As a founder using LeadSens, I want account and contact scores to display consistently across the product so that I can trust the grading system and make decisions based on it.

## Problem Statement
The frontend `letterGrade()` function in `ui-utils.ts` uses different thresholds than the backend grade assignment in `scoring.ts` and `score/route.ts`. A score of 65 shows as "C" in the UI but is stored as "B" in the database. This erodes trust in the scoring system.

## Acceptance Criteria

### Scenario: Grade consistency between storage and display
GIVEN a company with a score of 65
WHEN the score is calculated by the backend
AND the score is displayed in the accounts table
THEN both the stored grade and the displayed grade are "B"

### Scenario: Heat label alignment with grades
GIVEN a company with a score of 65
WHEN the score is displayed
THEN the heat label is "Warm" (matching the B grade range)
AND the color is warning/orange (not success/green)

### Scenario: A+ grade for elite accounts
GIVEN a company with a score of 92
WHEN displayed in the UI
THEN the grade shows "A+" (reserved for 90+)
AND the heat label is "Burning" with fire emoji

### Scenario: Single source of truth for thresholds
GIVEN the scoring thresholds
WHEN I check the codebase
THEN there is exactly ONE definition of grade thresholds used by both frontend and backend
AND it lives in `lib/scoring.ts` as a shared export

## Edge Cases
- Score of exactly 80 → should be "A" (not "B")
- Score of exactly 60 → should be "B" (not "C")
- Score of exactly 0 → should be "F"
- Score of null/undefined → display "—" (no grade)
- Score of 100 → should be "A+"

## Evaluation Steps
1. Run `pnpm test` — all existing scoring tests pass
2. Check `letterGrade(65)` returns "B" (not "C")
3. Check `letterGrade(80)` returns "A"
4. Check `letterGrade(92)` returns "A+"
5. Check that `heatLabel(65)` returns "Warm" (not "Cool")
6. Verify no other file defines its own grade thresholds
