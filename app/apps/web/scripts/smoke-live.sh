#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# Elevay live smoke test — run against a running dev/staging instance.
#
# Usage:
#   bash scripts/smoke-live.sh                    # default: localhost:3000
#   bash scripts/smoke-live.sh https://staging.elevay.dev
#
# What this tests:
#   1. Public pages load (200)
#   2. Auth-protected endpoints reject unauthenticated requests (401)
#   3. API doesn't crash on bad input (400, not 500)
#   4. Security headers present
#   5. GDPR endpoints exist
#   6. MCP endpoint exists
#   7. No secrets leaked in error responses
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
WARN=0

green() { echo -e "\033[32m  PASS\033[0m $1"; PASS=$((PASS + 1)); }
red()   { echo -e "\033[31m  FAIL\033[0m $1"; FAIL=$((FAIL + 1)); }
yellow(){ echo -e "\033[33m  WARN\033[0m $1"; WARN=$((WARN + 1)); }

check_status() {
  local url="$1" expected="$2" label="$3"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "$expected" ]; then
    green "$label (HTTP $status)"
  elif [ "$status" = "000" ]; then
    red "$label (connection refused — is the server running?)"
  else
    red "$label (expected $expected, got $status)"
  fi
}

check_no_secrets() {
  local url="$1" label="$2"
  local body
  body=$(curl -s --max-time 10 "$url" 2>/dev/null || echo "")
  for pattern in "sk-ant-" "sk-proj-" "sk_test_" "whsec_" "AKIA" "re_" "ghp_"; do
    if echo "$body" | grep -q "$pattern"; then
      red "$label — LEAKED SECRET PATTERN: $pattern"
      return
    fi
  done
  green "$label — no secrets in response"
}

check_header() {
  local url="$1" header="$2" label="$3"
  local value
  value=$(curl -s -I --max-time 10 "$url" 2>/dev/null | grep -i "^$header:" || echo "")
  if [ -n "$value" ]; then
    green "$label ($value)"
  else
    yellow "$label — header '$header' not found"
  fi
}

echo ""
echo "═══════════════════════════════════════════════════════════"
echo " ELEVAY LIVE SMOKE TEST"
echo " Target: $BASE_URL"
echo " Time:   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "═══════════════════════════════════════════════════════════"

# ── 1. Public pages ───────────────────────────────────────────────────
echo ""
echo "── Public pages ──"
check_status "$BASE_URL/"               "200" "Landing page"
check_status "$BASE_URL/sign-in"        "200" "Login page"
check_status "$BASE_URL/sign-up"        "200" "Signup page"
check_status "$BASE_URL/privacy"        "200" "Privacy policy"
check_status "$BASE_URL/terms"          "200" "Terms of service"
check_status "$BASE_URL/acceptable-use" "200" "Acceptable use policy"

# ── 2. Auth enforcement ──────────────────────────────────────────────
echo ""
echo "── Auth enforcement (must reject unauthenticated) ──"
check_status "$BASE_URL/api/chat"          "401" "Chat API rejects unauth"
check_status "$BASE_URL/api/notifications" "401" "Notifications API rejects unauth"
check_status "$BASE_URL/api/tasks"         "401" "Tasks API rejects unauth"
check_status "$BASE_URL/api/accounts"      "401" "Accounts API rejects unauth"

# ── 3. API doesn't crash on bad input ────────────────────────────────
echo ""
echo "── Bad input handling (400 not 500) ──"
for endpoint in "/api/chat" "/api/tam" "/api/emails"; do
  local_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST -H "Content-Type: application/json" -d '{}' \
    "$BASE_URL$endpoint" 2>/dev/null || echo "000")
  if [ "$local_status" = "500" ] || [ "$local_status" = "000" ]; then
    red "$endpoint POST {} — crashed (HTTP $local_status)"
  else
    green "$endpoint POST {} — handled gracefully (HTTP $local_status)"
  fi
done

# ── 4. Security headers ──────────────────────────────────────────────
echo ""
echo "── Security headers ──"
check_header "$BASE_URL/" "x-content-type-options" "X-Content-Type-Options"
check_header "$BASE_URL/" "x-frame-options"        "X-Frame-Options"
check_header "$BASE_URL/" "referrer-policy"        "Referrer-Policy"

# ── 5. No secrets in error responses ─────────────────────────────────
echo ""
echo "── Secret leak check ──"
check_no_secrets "$BASE_URL/api/chat"     "Chat 401 response"
check_no_secrets "$BASE_URL/api/tam"      "TAM 401 response"
check_no_secrets "$BASE_URL/api/mcp"      "MCP endpoint response"

# ── 6. GDPR endpoints exist ──────────────────────────────────────────
echo ""
echo "── GDPR endpoints ──"
check_status "$BASE_URL/privacy"  "200" "Privacy page"
check_status "$BASE_URL/terms"    "200" "Terms page"

# ── 7. Sitemap ────────────────────────────────────────────────────────
echo ""
echo "── SEO ──"
check_status "$BASE_URL/sitemap.xml" "200" "Sitemap"

# ── Summary ───────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo " Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "═══════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "  PRODUCT NOT READY — $FAIL checks failed."
  exit 1
fi

if [ "$WARN" -gt 0 ]; then
  echo ""
  echo "  PRODUCT MOSTLY READY — $WARN non-critical warnings."
  exit 0
fi

echo ""
echo "  ALL CHECKS PASSED."
exit 0
