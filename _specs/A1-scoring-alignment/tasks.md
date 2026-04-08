# A1: Scoring Alignment — Tasks

- [ ] Task 1: Add shared GRADE_THRESHOLDS + getGrade() to scoring.ts
  Verify: `getGrade(65).grade === "B"`, `getGrade(92).grade === "A+"`
  Test: Unit test for getGrade at boundary values (0, 19, 20, 39, 40, 59, 60, 79, 80, 89, 90, 100)

- [ ] Task 2: Update ui-utils.ts to use getGrade() from scoring.ts
  Verify: `letterGrade(65)` returns "B", `heatLabel(65)` returns "Warm"
  Test: Existing formatScore tests still pass

- [ ] Task 3: Update score/route.ts to use getGrade() instead of inline thresholds
  Verify: Backend grade assignment uses same thresholds as frontend
  Test: Scoring API test with score 65 returns grade "B"

- [ ] Task 4: Update scoring.ts calculateContactFitScore() to use getGrade()
  Verify: Contact fit grade uses same thresholds
  Test: Contact scoring test at boundary values

- [ ] Task 5: Run full test suite
  Verify: `pnpm test` passes
  Test: All 178+ existing tests pass
