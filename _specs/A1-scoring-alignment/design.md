# A1: Scoring Alignment — Design

## System Fit
The scoring system has 3 layers:
1. **Calculation** (`scoring.ts`, `contact-scoring.ts`, `score/route.ts`) — computes numeric score 0-100
2. **Storage** (`score/route.ts`) — stores score + grade + reasons in DB
3. **Display** (`ui-utils.ts`) — formats score for table/badge rendering

The bug is that layer 3 uses different thresholds than layers 1-2.

## Changes

### 1. Create shared grade constants in `scoring.ts`

Export grade thresholds as a single source of truth:
```ts
export const GRADE_THRESHOLDS = [
  { min: 90, grade: "A+", heat: "Burning", icon: "🔥" },
  { min: 80, grade: "A",  heat: "Burning", icon: "🔥" },
  { min: 60, grade: "B",  heat: "Warm",    icon: "☀️" },
  { min: 40, grade: "C",  heat: "Cool",    icon: "" },
  { min: 20, grade: "D",  heat: "Cold",    icon: "" },
  { min: 0,  grade: "F",  heat: "Cold",    icon: "" },
];

export function getGrade(score: number) {
  return GRADE_THRESHOLDS.find(t => score >= t.min) || GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];
}
```

### 2. Update `ui-utils.ts` to import from `scoring.ts`

Replace `letterGrade()` and `heatLabel()` with calls to `getGrade()`.
Keep the heat color mapping in ui-utils since it references CSS variables.

### 3. Update `score/route.ts` to use `getGrade()`

Replace inline grade assignment (lines 175-180) with `getGrade(totalScore).grade`.

### 4. Update `scoring.ts` `calculateContactFitScore()` to use `getGrade()`

Replace inline grade assignment (lines 217-222) with `getGrade(score).grade`.

## Data Model Changes
None — the `score` field is numeric, `score_grade` in properties is recalculated.

## API Changes
None — response format unchanged.

## Failure Handling
- If `scoring.ts` import fails in `ui-utils.ts`, the build will fail at compile time (good — caught early)
- Existing scores in DB with old grades will be stale until re-scored, but display will be correct because the UI now computes grade from the numeric score
