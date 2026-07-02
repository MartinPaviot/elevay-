/**
 * Pure funding classification for the Apollo funding monitor — extracted from
 * handler.ts so the "what counts as NEW funding" rule is unit-tested away from
 * the DB/Apollo IO.
 *
 * The load-bearing rule: "new" funding requires an OBSERVED CHANGE against a
 * prior baseline. First sight (no previousFunding) is NOT new — it's the first
 * enrichment — so it records the weaker steady-state `funding`, not
 * `funding_recent`. This is what stops a UN agency's Apollo budget number from
 * firing "just raised, reach out this week".
 */

export interface FundingClassifyInput {
  currentFunding: number | null | undefined;
  currentStage: string | null | undefined;
  previousFunding: number | null | undefined;
  previousStage: string | null | undefined;
  minFundingAmount: number;
  targetFundingStages: string[];
}

export interface FundingClassification {
  /** currentFunding >= minFundingAmount — below this we record nothing. */
  qualifies: boolean;
  /** An observed increase / stage change against a prior baseline. */
  isNewFunding: boolean;
  isTargetStage: boolean;
  /** The signal type to record — `funding_recent` only on a real, observed change. */
  signalType: "funding_recent" | "funding";
  signalStrength: "high" | "medium" | "low";
}

export function classifyFundingSignal(input: FundingClassifyInput): FundingClassification {
  const { currentFunding, currentStage, previousFunding, previousStage, minFundingAmount, targetFundingStages } = input;

  const qualifies = !!(currentFunding && currentFunding >= minFundingAmount);

  const isNewFunding = !!(
    qualifies &&
    previousFunding && // an observed baseline must exist — first sight is not "new"
    (
      (currentFunding as number) > previousFunding * 1.1 || // 10%+ increase
      (currentStage && previousStage && currentStage !== previousStage)
    )
  );

  const isTargetStage = currentStage
    ? targetFundingStages.some((s) => currentStage.toLowerCase().includes(s.toLowerCase()))
    : false;

  const signalStrength: "high" | "medium" | "low" =
    isNewFunding && isTargetStage ? "high" : isNewFunding || isTargetStage ? "medium" : "low";

  return {
    qualifies,
    isNewFunding,
    isTargetStage,
    signalType: isNewFunding ? "funding_recent" : "funding",
    signalStrength,
  };
}
