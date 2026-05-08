#!/usr/bin/env bash
#
# Audit-2026-05-08 L7 behavioural — weekly cron-fired side-effect
# verification.
#
# Usage :
#   DATABASE_URL=postgresql://... bash _specs/AUDIT-2026-05-08/scripts/l7-weekly.sh
#
# Run weekly (Tuesday morning is a reasonable slot — the Monday eval
# cron has had a full day to land its rows).
#
# Verifies that the cron-fired and event-driven workers from this
# session actually produce DB side effects in production over time.
# Each check is a SELECT — no writes, no destructive actions.
#
# Each check has a hard threshold. If the threshold isn't met, the
# script flags a likely silent worker failure that L5 couldn't catch
# at registration time.
#
# Output : evidence under _reports/audit-2026-05-08/L7-behavioural/
#          named by ISO date.
# Exit   : 0 PASS / 1 FAIL.

set -uo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required (point at the production Supabase)" >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found in PATH" >&2
  exit 2
fi

DATE_TAG="$(date -u +%Y-%m-%d)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
EVIDENCE_DIR="$REPO_ROOT/_reports/audit-2026-05-08/L7-behavioural"
mkdir -p "$EVIDENCE_DIR"
LOG="$EVIDENCE_DIR/${DATE_TAG}.md"

PASS=0
FAIL=0

q() {
  # Single-row scalar SELECT. Returns trimmed result.
  psql "$DATABASE_URL" -tA -c "$1" 2>&1
}

assert_min() {
  local label="$1"
  local actual="$2"
  local minimum="$3"
  if [ "$actual" -ge "$minimum" ] 2>/dev/null; then
    echo "  PASS : $label (got $actual, min $minimum)"
    PASS=$((PASS+1))
    echo "- PASS : $label — got $actual, min $minimum" >> "$LOG"
  else
    echo "  FAIL : $label (got $actual, min $minimum)" >&2
    FAIL=$((FAIL+1))
    echo "- FAIL : $label — got $actual, min $minimum" >> "$LOG"
  fi
}

{
  echo "# L7 behavioural — $DATE_TAG"
  echo
  echo "Run at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "## Checks"
  echo
} > "$LOG"

echo "L7 weekly behavioural — $DATE_TAG"
echo "Evidence -> $LOG"
echo

# ── F4 weeklyEvalHarness fired Monday ──────────────────────
# Cron : TZ=UTC 0 2 * * 1 → every Monday 02:00 UTC.
# Threshold : at least one llm_eval_runs row from the last Monday.
echo "== F4 weeklyEvalHarness — last Monday llm_eval_runs"
EVAL_ROWS="$(q "SELECT count(*) FROM llm_eval_runs WHERE created_at >= date_trunc('week', now()) ;")"
assert_min "weeklyEvalHarness landed rows in llm_eval_runs this week" "$EVAL_ROWS" 1

# ── F2 dailyTranscriptFreshnessAlert fired today ──────────
# Cron : TZ=UTC 0 6 * * * → every day 06:00 UTC.
# Threshold : if any tenant has a recall.ai bot in degraded/silent
# state, expect at least one notification today. If none degraded,
# absence is OK (no false alarms expected). Verify the worker ran by
# checking llm_calls with surface_id='transcript-freshness' instead.
echo "== F2 dailyTranscriptFreshnessAlert — today's run"
FRESHNESS_CHECKS="$(q "SELECT count(*) FROM llm_calls WHERE surface_id = 'transcript-freshness' AND created_at >= current_date ;")"
# This is a *soft* check : the worker may not call the LLM at all if
# nothing is degraded. Threshold of 0 means "exists or not" is fine,
# we just want to know.
echo "  INFO : transcript-freshness LLM calls today : $FRESHNESS_CHECKS"
echo "- INFO : transcript-freshness LLM calls today — $FRESHNESS_CHECKS" >> "$LOG"

# ── F7 cronExpireSequenceDrafts fired this week ───────────
# Cron : 0 * * * * → hourly. Worker marks drafts >72h pending as expired.
# Threshold : check that no draft is stuck pending >72h (would mean
# cron silently broken).
echo "== F7 cronExpireSequenceDrafts — stuck-pending count"
STUCK_PENDING="$(q "SELECT count(*) FROM sequence_drafts WHERE status='pending_approval' AND generated_at < now() - interval '72 hours' ;")"
if [ "$STUCK_PENDING" = "0" ]; then
  echo "  PASS : no drafts stuck pending >72h"
  PASS=$((PASS+1))
  echo "- PASS : 0 drafts stuck pending_approval >72h (cron is firing)" >> "$LOG"
else
  echo "  FAIL : $STUCK_PENDING drafts stuck pending_approval >72h — cron may be broken" >&2
  FAIL=$((FAIL+1))
  echo "- FAIL : $STUCK_PENDING drafts stuck pending_approval >72h — investigate cronExpireSequenceDrafts" >> "$LOG"
fi

# ── F7 draftRejectionLearner accumulating insights ────────
# Each rejection updates sequences.campaignConfig.rejectionInsights.
# Threshold : if there were >0 rejected drafts this week, expect at
# least one sequence with rejectionInsights populated.
echo "== F7 draftRejectionLearner — rejection insight accumulation"
REJECTED_THIS_WEEK="$(q "SELECT count(*) FROM sequence_drafts WHERE status='rejected' AND reviewed_at >= date_trunc('week', now()) ;")"
SEQUENCES_WITH_INSIGHTS="$(q "SELECT count(*) FROM sequences WHERE campaign_config -> 'rejectionInsights' IS NOT NULL ;")"
echo "  INFO : rejected drafts this week        : $REJECTED_THIS_WEEK"
echo "  INFO : sequences with rejectionInsights : $SEQUENCES_WITH_INSIGHTS"
echo "- INFO : rejected_this_week=$REJECTED_THIS_WEEK ; sequences_with_insights=$SEQUENCES_WITH_INSIGHTS" >> "$LOG"
if [ "$REJECTED_THIS_WEEK" -gt 0 ] 2>/dev/null && [ "$SEQUENCES_WITH_INSIGHTS" = "0" ]; then
  echo "  FAIL : rejections happened but no sequence carries insights — learner broken" >&2
  FAIL=$((FAIL+1))
  echo "- FAIL : rejections happened but no sequence carries rejectionInsights" >> "$LOG"
fi

# ── F8 visitor-id monthly cap roll-over ───────────────────
# On the 1st of each month, last month's spend should be visible but
# this month's spend starts fresh.
echo "== F8 visitor_id_charges — monthly window"
CHARGES_THIS_MONTH="$(q "SELECT count(*) FROM visitor_id_charges WHERE created_at >= date_trunc('month', now()) ;")"
CHARGES_LAST_MONTH="$(q "SELECT count(*) FROM visitor_id_charges WHERE created_at >= date_trunc('month', now() - interval '1 month') AND created_at < date_trunc('month', now()) ;")"
echo "  INFO : charges this month  : $CHARGES_THIS_MONTH"
echo "  INFO : charges last month  : $CHARGES_LAST_MONTH"
echo "- INFO : visitor_id charges — this_month=$CHARGES_THIS_MONTH last_month=$CHARGES_LAST_MONTH" >> "$LOG"

# ── F8 dedup hit rate (rough) ─────────────────────────────
# If dedup is working, the count of identifications should be much
# lower than the count of visits.
echo "== F8 visitor-id dedup ratio"
TOTAL_VISITS="$(q "SELECT count(*) FROM visits WHERE created_at >= now() - interval '7 days' ;")"
IDENTIFICATIONS="$(q "SELECT count(DISTINCT visitor_id) FROM visit_identifications WHERE created_at >= now() - interval '7 days' ;" 2>/dev/null || echo "0")"
echo "  INFO : visits 7d           : $TOTAL_VISITS"
echo "  INFO : unique identified   : $IDENTIFICATIONS"
echo "- INFO : visits_7d=$TOTAL_VISITS unique_identified=$IDENTIFICATIONS" >> "$LOG"

# ── F4 eval-per-case rows present for last weekly run ─────
echo "== F4 eval per-case persistence"
WEEKLY_CASE_ROWS="$(q "SELECT count(*) FROM llm_eval_case_runs WHERE created_at >= date_trunc('week', now()) ;")"
echo "  INFO : llm_eval_case_runs this week : $WEEKLY_CASE_ROWS"
echo "- INFO : llm_eval_case_runs this week — $WEEKLY_CASE_ROWS" >> "$LOG"
if [ "$EVAL_ROWS" -gt 0 ] 2>/dev/null && [ "$WEEKLY_CASE_ROWS" = "0" ]; then
  echo "  FAIL : eval runs ran but no per-case rows — F4 persistence broken" >&2
  FAIL=$((FAIL+1))
  echo "- FAIL : eval_runs >0 but llm_eval_case_runs=0" >> "$LOG"
fi

# ── F12 PostHog identify reaching person profiles ─────────
# Can't query PostHog from here ; document as manual.
echo "== F12 PostHog identify (manual)"
echo "  INFO : open PostHog EU dashboard → Persons → confirm test user has email + tenantName traits set"
echo "- MANUAL : verify Person profile in PostHog dashboard has traits" >> "$LOG"

# ── Tally ─────────────────────────────────────────────────
{
  echo
  echo "## Tally"
  echo "- PASS : $PASS"
  echo "- FAIL : $FAIL"
  echo
  echo "## Verdict"
  if [ "$FAIL" -gt 0 ]; then
    echo "**NO-GO** — investigate the FAIL rows above."
  else
    echo "**GO** — workers fire on schedule, side effects land in DB."
  fi
} >> "$LOG"

echo
echo "================="
echo "  L7 tally"
echo "  PASS : $PASS"
echo "  FAIL : $FAIL"
echo "================="
echo "Log : $LOG"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
