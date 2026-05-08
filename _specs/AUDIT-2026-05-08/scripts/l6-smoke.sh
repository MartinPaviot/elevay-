#!/usr/bin/env bash
#
# Audit-2026-05-08 L6 production smoke — one-shot script.
#
# Usage :
#   bash _specs/AUDIT-2026-05-08/scripts/l6-smoke.sh <PREVIEW_URL>
#
# Example :
#   bash _specs/AUDIT-2026-05-08/scripts/l6-smoke.sh https://leads-git-audit-2026-05-08.vercel.app
#
# Verifies the parts of L6 that can be checked from the command line :
#   - 200 on every public surface
#   - CSP header on / contains both PostHog EU hosts on connect-src + script-src
#   - Brand string "Elevay" appears (no "LeadSens" leak)
#   - No "5xx" or "Internal Server Error" in any tested body
#
# Manual follow-up after this script (needs a browser session) :
#   - PostHog dashboard event window (last 30 min : $pageview, autocapture)
#   - Session replay tab : at least one recording with masked inputs
#   - Person profile : test user has email + name + tenantName traits
#   - Trigger an error → confirm error_boundary_tripped event lands
#
# Output : evidence under _reports/audit-2026-05-08/L6-prod-smoke/post-deploy/
# Exit   : 0 PASS / 1 FAIL ; on FAIL, last assertion line on stderr.

set -uo pipefail

URL="${1:-}"
if [ -z "$URL" ]; then
  echo "usage: $0 <PREVIEW_URL>" >&2
  exit 2
fi

# Strip trailing slash
URL="${URL%/}"

# Resolve audit evidence dir relative to repo root (script location).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
EVIDENCE_DIR="$REPO_ROOT/_reports/audit-2026-05-08/L6-prod-smoke/post-deploy"
mkdir -p "$EVIDENCE_DIR"

PASS=0
FAIL=0

assert() {
  local label="$1"
  local got="$2"
  local want="$3"
  if echo "$got" | grep -qE "$want"; then
    echo "  PASS : $label"
    PASS=$((PASS+1))
  else
    echo "  FAIL : $label" >&2
    echo "         expected pattern : $want" >&2
    echo "         got              : $(echo "$got" | head -c 200)" >&2
    FAIL=$((FAIL+1))
  fi
}

echo "L6 smoke against $URL"
echo "Evidence -> $EVIDENCE_DIR"
echo

# ── CSP header on / ────────────────────────────────────────
echo "== CSP header"
HEADERS="$(curl -sI "$URL/" 2>&1)"
echo "$HEADERS" > "$EVIDENCE_DIR/headers-root.txt"
CSP="$(echo "$HEADERS" | grep -i "^content-security-policy:" || true)"

assert "/ returns 200" "$HEADERS" "^HTTP/[12].* 200"
assert "CSP header present" "$CSP" "Content-Security-Policy"
assert "CSP connect-src includes eu.i.posthog.com" "$CSP" "connect-src[^;]*https://eu.i.posthog.com"
assert "CSP connect-src includes eu-assets.i.posthog.com" "$CSP" "connect-src[^;]*https://eu-assets.i.posthog.com"
assert "CSP script-src includes eu-assets.i.posthog.com" "$CSP" "script-src[^;]*https://eu-assets.i.posthog.com"
assert "CSP frame-ancestors 'none'" "$CSP" "frame-ancestors 'none'"
assert "CSP object-src 'none'" "$CSP" "object-src 'none'"

# ── Body content checks ────────────────────────────────────
echo
echo "== / body"
BODY="$(curl -s "$URL/" 2>&1)"
echo "$BODY" > "$EVIDENCE_DIR/body-root.html"
assert "Brand 'Elevay' present" "$BODY" "Elevay"
assert "No LeadSens leak"   "$BODY" "^((?!LeadSens).)*$" || true   # negative grep is hard ; check below
if echo "$BODY" | grep -q "LeadSens"; then
  echo "  FAIL : 'LeadSens' string found in landing body" >&2
  FAIL=$((FAIL+1))
else
  echo "  PASS : No 'LeadSens' string in landing body"
  PASS=$((PASS+1))
fi
assert "No 'Internal Server Error'" "$BODY" "^((?!Internal Server Error).)*$" || true
if echo "$BODY" | grep -qE "Internal Server Error|5[0-9][0-9] error"; then
  echo "  FAIL : 5xx error string in landing body" >&2
  FAIL=$((FAIL+1))
else
  echo "  PASS : No 5xx error string in landing body"
  PASS=$((PASS+1))
fi

# ── Public surfaces ────────────────────────────────────────
echo
echo "== public surfaces"
for path in "/" "/sign-in" "/sign-up"; do
  STATUS="$(curl -s -o /dev/null -w "%{http_code}" "$URL$path")"
  if [ "$STATUS" = "200" ]; then
    echo "  PASS : $path -> 200"
    PASS=$((PASS+1))
  else
    echo "  FAIL : $path -> $STATUS" >&2
    FAIL=$((FAIL+1))
  fi
done

# ── Auth-gated surfaces (expect 302 or 200 on sign-in redirect) ──
echo
echo "== auth-gated redirect targets"
for path in "/home" "/onboarding-v3" "/sequences/review" "/opportunities" "/chat" "/settings/llm-evals"; do
  STATUS="$(curl -s -o /dev/null -w "%{http_code}" "$URL$path")"
  case "$STATUS" in
    200|302|307)
      echo "  PASS : $path -> $STATUS (auth-gated, redirect or render)"
      PASS=$((PASS+1));;
    *)
      echo "  FAIL : $path -> $STATUS" >&2
      FAIL=$((FAIL+1));;
  esac
done

# ── Inngest health endpoint ────────────────────────────────
echo
echo "== Inngest handler"
INNGEST_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "$URL/api/inngest")"
if [ "$INNGEST_STATUS" = "200" ] || [ "$INNGEST_STATUS" = "401" ]; then
  echo "  PASS : /api/inngest -> $INNGEST_STATUS (responsive)"
  PASS=$((PASS+1))
else
  echo "  FAIL : /api/inngest -> $INNGEST_STATUS" >&2
  FAIL=$((FAIL+1))
fi

# ── Tally ──────────────────────────────────────────────────
echo
echo "================="
echo "  L6 smoke tally"
echo "  PASS : $PASS"
echo "  FAIL : $FAIL"
echo "================="

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "L6 verdict : NO-GO" >&2
  echo "Inspect evidence at $EVIDENCE_DIR" >&2
  exit 1
fi

# Ship a per-run SUMMARY with the verdict.
{
  echo "# L6 prod smoke — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "URL : $URL"
  echo
  echo "## Tally"
  echo "- PASS : $PASS"
  echo "- FAIL : $FAIL"
  echo
  echo "## Verdict : GO"
  echo
  echo "Evidence in this directory : headers-root.txt, body-root.html"
  echo
  echo "## Manual follow-up (needs a browser session)"
  echo "1. Open PostHog EU dashboard, filter events for the last 30 min."
  echo "   Expected : \$pageview, \$autocapture, identify (after sign-in)."
  echo "2. Session Replay tab : at least one recording with all <input>"
  echo "   values masked as \`***\`."
  echo "3. Person profile for the test user : email, name, tenantName"
  echo "   traits set."
  echo "4. Trigger an error in the dashboard tree : confirm"
  echo "   error_boundary_tripped event with boundary='dashboard' lands."
} > "$EVIDENCE_DIR/SUMMARY.md"

echo
echo "L6 verdict : GO"
exit 0
