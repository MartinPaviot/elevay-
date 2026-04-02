#!/bin/bash
# Comprehensive E2E test — every API endpoint, every page
# Usage: bash _tools/e2e-full-test.sh

COOKIE="/tmp/e2e-cookies.txt"
BASE="http://localhost:3000"
PASS=0
FAIL=0
ERRORS=""
RESULTS=""

log() {
  local status="$1" endpoint="$2" detail="$3"
  if [ "$status" = "PASS" ]; then
    PASS=$((PASS + 1))
    RESULTS+="PASS | $endpoint | $detail\n"
  else
    FAIL=$((FAIL + 1))
    RESULTS+="FAIL | $endpoint | $detail\n"
    ERRORS+="FAIL: $endpoint — $detail\n"
  fi
  echo "$status: $endpoint — $detail"
}

test_get() {
  local endpoint="$1" expect_code="${2:-200}"
  local resp=$(curl -s -b "$COOKIE" -w "\n%{http_code}" "$BASE$endpoint" 2>/dev/null)
  local code=$(echo "$resp" | tail -1)
  local body=$(echo "$resp" | sed '$d')
  if [ "$code" = "$expect_code" ]; then
    log "PASS" "GET $endpoint" "HTTP $code"
  else
    log "FAIL" "GET $endpoint" "Expected $expect_code, got $code — $(echo "$body" | head -c 100)"
  fi
  echo "$body" > /tmp/e2e-last-body.txt
}

test_post() {
  local endpoint="$1" data="$2" expect_code="${3:-200}" content_type="${4:-application/json}"
  local resp=$(curl -s -b "$COOKIE" -X POST "$BASE$endpoint" \
    -H "Content-Type: $content_type" \
    -d "$data" \
    -w "\n%{http_code}" 2>/dev/null)
  local code=$(echo "$resp" | tail -1)
  local body=$(echo "$resp" | sed '$d')
  if [ "$code" = "$expect_code" ]; then
    log "PASS" "POST $endpoint" "HTTP $code"
  else
    log "FAIL" "POST $endpoint" "Expected $expect_code, got $code — $(echo "$body" | head -c 200)"
  fi
  echo "$body" > /tmp/e2e-last-body.txt
}

test_put() {
  local endpoint="$1" data="$2" expect_code="${3:-200}"
  local resp=$(curl -s -b "$COOKIE" -X PUT "$BASE$endpoint" \
    -H "Content-Type: application/json" \
    -d "$data" \
    -w "\n%{http_code}" 2>/dev/null)
  local code=$(echo "$resp" | tail -1)
  local body=$(echo "$resp" | sed '$d')
  if [ "$code" = "$expect_code" ]; then
    log "PASS" "PUT $endpoint" "HTTP $code"
  else
    log "FAIL" "PUT $endpoint" "Expected $expect_code, got $code — $(echo "$body" | head -c 200)"
  fi
  echo "$body" > /tmp/e2e-last-body.txt
}

test_patch() {
  local endpoint="$1" data="$2" expect_code="${3:-200}"
  local resp=$(curl -s -b "$COOKIE" -X PATCH "$BASE$endpoint" \
    -H "Content-Type: application/json" \
    -d "$data" \
    -w "\n%{http_code}" 2>/dev/null)
  local code=$(echo "$resp" | tail -1)
  local body=$(echo "$resp" | sed '$d')
  if [ "$code" = "$expect_code" ]; then
    log "PASS" "PATCH $endpoint" "HTTP $code"
  else
    log "FAIL" "PATCH $endpoint" "Expected $expect_code, got $code — $(echo "$body" | head -c 200)"
  fi
  echo "$body" > /tmp/e2e-last-body.txt
}

test_delete() {
  local endpoint="$1" expect_code="${2:-200}"
  local resp=$(curl -s -b "$COOKIE" -X DELETE "$BASE$endpoint" \
    -w "\n%{http_code}" 2>/dev/null)
  local code=$(echo "$resp" | tail -1)
  local body=$(echo "$resp" | sed '$d')
  if [ "$code" = "$expect_code" ]; then
    log "PASS" "DELETE $endpoint" "HTTP $code"
  else
    log "FAIL" "DELETE $endpoint" "Expected $expect_code, got $code — $(echo "$body" | head -c 200)"
  fi
}

test_page() {
  local path="$1" expect_code="${2:-200}"
  local resp=$(curl -s -b "$COOKIE" -w "\n%{http_code}" -L "$BASE$path" 2>/dev/null)
  local code=$(echo "$resp" | tail -1)
  if [ "$code" = "$expect_code" ]; then
    log "PASS" "PAGE $path" "HTTP $code"
  else
    log "FAIL" "PAGE $path" "Expected $expect_code, got $code"
  fi
}

echo "=========================================="
echo "  COMPREHENSIVE E2E TEST SUITE"
echo "  $(date)"
echo "=========================================="
echo ""

# ==========================================
# SECTION 1: HEALTH & STATUS
# ==========================================
echo "--- SECTION 1: Health & Status ---"
test_get "/api/health"
test_get "/api/features"
test_get "/api/onboarding/status"

# ==========================================
# SECTION 2: ACCOUNTS CRUD
# ==========================================
echo ""
echo "--- SECTION 2: Accounts CRUD ---"
test_get "/api/accounts"

# Get first account ID
ACCOUNT_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if isinstance(d,list) and len(d)>0 else d.get('accounts',d.get('data',[]))[0]['id'])" 2>/dev/null)
echo "Using account ID: $ACCOUNT_ID"

if [ -n "$ACCOUNT_ID" ] && [ "$ACCOUNT_ID" != "" ]; then
  test_get "/api/accounts/$ACCOUNT_ID"
  test_put "/api/accounts/$ACCOUNT_ID" '{"name":"E2E Test Update Corp","industry":"Testing"}'

  # Test lifecycle
  test_post "/api/accounts/$ACCOUNT_ID/lifecycle" '{"stage":"customer"}'

  # Test account contacts
  test_post "/api/accounts/$ACCOUNT_ID/contacts" '{}'

  # Test summarize
  test_post "/api/accounts/$ACCOUNT_ID/summarize" '{}'

  # Test suggested contacts (Apollo — may fail if no API key)
  test_get "/api/accounts/$ACCOUNT_ID/suggested-contacts"
fi

# Create a new account
test_post "/api/accounts" '{"name":"E2E Full Test Corp","domain":"e2efulltest.com","industry":"SaaS"}'
NEW_ACCOUNT_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

# Test PATCH custom fields
test_patch "/api/accounts" '{"ids":["'$ACCOUNT_ID'"],"properties":{"e2e_test":"true"}}'

# ==========================================
# SECTION 3: CONTACTS CRUD
# ==========================================
echo ""
echo "--- SECTION 3: Contacts CRUD ---"
test_get "/api/contacts"

CONTACT_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if isinstance(d,list) and len(d)>0 else d.get('contacts',d.get('data',[]))[0]['id'])" 2>/dev/null)
echo "Using contact ID: $CONTACT_ID"

if [ -n "$CONTACT_ID" ]; then
  test_get "/api/contacts/$CONTACT_ID"
fi

# Create contact
test_post "/api/contacts" '{"firstName":"E2E","lastName":"TestContact","email":"e2e-full@test.com","companyId":"'$ACCOUNT_ID'"}'
NEW_CONTACT_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "New contact ID: $NEW_CONTACT_ID"

# ==========================================
# SECTION 4: DEALS / OPPORTUNITIES
# ==========================================
echo ""
echo "--- SECTION 4: Deals & Opportunities ---"
test_get "/api/opportunities"

DEAL_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if isinstance(d,list) and len(d)>0 else d.get('deals',d.get('data',[]))[0]['id'])" 2>/dev/null)
echo "Using deal ID: $DEAL_ID"

if [ -n "$DEAL_ID" ]; then
  test_get "/api/opportunities/$DEAL_ID"
  test_get "/api/deals/$DEAL_ID"
  test_put "/api/deals/$DEAL_ID" '{"stage":"proposal","value":99999}'
  test_get "/api/deals/$DEAL_ID/timeline"
  test_post "/api/deals/$DEAL_ID/extract" '{"notes":"Customer mentioned budget is $50K, timeline Q3 2026"}'
  test_post "/api/opportunities/$DEAL_ID/extract-intel" '{"notes":"Competitor is Salesforce, decision maker is VP Sales"}'
fi

# Create deal
test_post "/api/opportunities" '{"name":"E2E Full Deal","stage":"lead","value":42000,"companyId":"'$ACCOUNT_ID'"}'
NEW_DEAL_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

# Analyze deals
test_post "/api/deals/analyze" '{}'

# ==========================================
# SECTION 5: ACTIVITIES
# ==========================================
echo ""
echo "--- SECTION 5: Activities ---"
test_get "/api/activities"
test_post "/api/activities" '{"entityType":"company","entityId":"'$ACCOUNT_ID'","activityType":"note_created","channel":"manual","direction":"internal","summary":"E2E test activity"}'

# ==========================================
# SECTION 6: TASKS
# ==========================================
echo ""
echo "--- SECTION 6: Tasks ---"
test_get "/api/tasks"
test_post "/api/tasks" '{"title":"E2E Full Test Task","description":"Created by E2E test","priority":"high","dueDate":"2026-04-10"}'
TASK_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "Task ID: $TASK_ID"

if [ -n "$TASK_ID" ]; then
  test_patch "/api/tasks/$TASK_ID" '{"status":"completed"}'
fi

# ==========================================
# SECTION 7: NOTES
# ==========================================
echo ""
echo "--- SECTION 7: Notes ---"
test_get "/api/notes"
test_post "/api/notes" '{"title":"E2E Full Test Note","content":"This note tests the full E2E flow","entityType":"company","entityId":"'$ACCOUNT_ID'"}'

# ==========================================
# SECTION 8: CHAT & THREADS
# ==========================================
echo ""
echo "--- SECTION 8: Chat & Threads ---"
test_get "/api/chat/threads"

# Create thread
test_post "/api/chat/threads" '{"title":"E2E Test Thread"}'
THREAD_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "Thread ID: $THREAD_ID"

if [ -n "$THREAD_ID" ]; then
  test_get "/api/chat/threads/$THREAD_ID"
  test_post "/api/chat/threads/$THREAD_ID" '{"messages":[{"role":"user","content":"E2E test message"}]}'
fi

# ==========================================
# SECTION 9: SEQUENCES
# ==========================================
echo ""
echo "--- SECTION 9: Sequences ---"
test_get "/api/sequences"

# Create sequence
test_post "/api/sequences" '{"name":"E2E Test Sequence","description":"Automated test sequence"}'
SEQ_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "Sequence ID: $SEQ_ID"

if [ -n "$SEQ_ID" ]; then
  test_get "/api/sequences/$SEQ_ID"
  test_put "/api/sequences/$SEQ_ID" '{"name":"E2E Updated Sequence","status":"active"}'

  # Add step
  test_post "/api/sequences/$SEQ_ID/steps" '{"stepNumber":1,"subjectTemplate":"Hi {{firstName}}","bodyTemplate":"<p>Test email body</p>","delayDays":1}'

  # Get suggestions
  test_get "/api/sequences/$SEQ_ID/suggestions"

  # Enroll contact
  if [ -n "$NEW_CONTACT_ID" ]; then
    test_post "/api/sequences/$SEQ_ID/enroll" '{"contactIds":["'$NEW_CONTACT_ID'"]}'
  fi

  # Autopilot
  test_post "/api/sequences/$SEQ_ID/autopilot" '{}'
fi

# ==========================================
# SECTION 10: EMAIL & DELIVERABILITY
# ==========================================
echo ""
echo "--- SECTION 10: Email & Deliverability ---"
test_get "/api/email/status"
# email sync requires Gmail OAuth — test graceful error
test_post "/api/email/sync" '{}'
test_post "/api/deliverability" '{}'
test_post "/api/emails/follow-up" '{"contactId":"'$CONTACT_ID'","context":"Follow up on demo"}'
test_post "/api/emails/suggest-reply" '{"emailContent":"Thanks for the demo, we are interested","contactId":"'$CONTACT_ID'"}'

# ==========================================
# SECTION 11: CALENDAR & MEETINGS
# ==========================================
echo ""
echo "--- SECTION 11: Calendar & Meetings ---"
test_post "/api/calendar/sync" '{}'
test_post "/api/meetings/process-transcript" '{"transcript":"John: So the budget is $50K.\nJane: Great, let us send a proposal.\nJohn: We need it by Friday.","dealId":"'$DEAL_ID'"}'

# ==========================================
# SECTION 12: NOTIFICATIONS
# ==========================================
echo ""
echo "--- SECTION 12: Notifications ---"
test_get "/api/notifications"
test_post "/api/notifications" '{"type":"system","title":"E2E Test","body":"Test notification"}'
test_get "/api/notifications/preferences"
test_put "/api/notifications/preferences" '{"emailEnabled":true,"inAppEnabled":true,"preferences":{"deal_risk":true,"deal_won":true}}'

# ==========================================
# SECTION 13: SETTINGS
# ==========================================
echo ""
echo "--- SECTION 13: Settings ---"
test_get "/api/settings/workspace"
test_get "/api/settings/stages"
test_get "/api/settings/data-model"
test_get "/api/settings/workflows"
test_get "/api/settings/custom-signals"
test_get "/api/settings/knowledge"
test_get "/api/settings/mailboxes"

# Write settings
test_put "/api/settings/workspace" '{"name":"E2E Test Workspace","timezone":"America/New_York"}'
test_put "/api/settings/stages" '{"stages":[{"id":"lead","name":"Lead","order":0},{"id":"qualification","name":"Qualification","order":1},{"id":"demo","name":"Demo","order":2},{"id":"proposal","name":"Proposal","order":3},{"id":"negotiation","name":"Negotiation","order":4},{"id":"won","name":"Won","order":5},{"id":"lost","name":"Lost","order":6}]}'
test_put "/api/settings/data-model" '{"fields":[{"id":"e2e_test","name":"E2E Test Field","type":"text","entity":"company"}]}'
test_put "/api/settings/workflows" '{"rules":[{"id":"e2e-rule","name":"E2E Test Rule","trigger":"deal_created","conditions":[],"actions":[{"type":"notify","config":{}}]}]}'
test_put "/api/settings/custom-signals" '{"signals":[{"id":"e2e-signal","name":"E2E Signal","description":"Test signal","weight":5}]}'

# Knowledge CRUD
test_post "/api/settings/knowledge" '{"title":"E2E Knowledge","content":"This is test knowledge for E2E"}'
KNOWLEDGE_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$KNOWLEDGE_ID" ]; then
  test_put "/api/settings/knowledge" '{"id":"'$KNOWLEDGE_ID'","title":"E2E Knowledge Updated","content":"Updated content"}'
  test_delete "/api/settings/knowledge?id=$KNOWLEDGE_ID"
fi

# Mailboxes
test_post "/api/settings/mailboxes" '{"emailAddress":"e2e@test.com","displayName":"E2E Test","provider":"smtp"}'
MAILBOX_ID=$(cat /tmp/e2e-last-body.txt | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$MAILBOX_ID" ]; then
  test_patch "/api/settings/mailboxes" '{"id":"'$MAILBOX_ID'","status":"paused"}'
  test_delete "/api/settings/mailboxes?id=$MAILBOX_ID"
fi

# ==========================================
# SECTION 14: BILLING
# ==========================================
echo ""
echo "--- SECTION 14: Billing ---"
test_get "/api/billing/subscription"
test_get "/api/billing/usage"
test_post "/api/billing/checkout" '{"priceId":"price_test_123"}'
test_post "/api/billing/portal" '{}'

# ==========================================
# SECTION 15: SEARCH & ENRICHMENT
# ==========================================
echo ""
echo "--- SECTION 15: Search & Enrichment ---"
test_post "/api/search" '{"query":"SaaS companies"}'
test_post "/api/search/tam" '{"query":"fintech startups"}'
test_post "/api/enrich" '{"companyIds":["'$ACCOUNT_ID'"]}'
test_post "/api/enrich-contacts" '{"contactIds":["'$CONTACT_ID'"]}'
test_post "/api/embed" '{"entityType":"company","entityId":"'$ACCOUNT_ID'"}'
test_post "/api/recall-test" '{"query":"test recall accuracy"}'

# ==========================================
# SECTION 16: SCORING & SIGNALS
# ==========================================
echo ""
echo "--- SECTION 16: Scoring & Signals ---"
test_post "/api/score" '{"companyIds":["'$ACCOUNT_ID'"]}'
test_post "/api/score-contacts" '{"contactIds":["'$CONTACT_ID'"]}'
test_post "/api/signals" '{"companyId":"'$ACCOUNT_ID'"}'

# ==========================================
# SECTION 17: ANALYTICS & INSIGHTS
# ==========================================
echo ""
echo "--- SECTION 17: Analytics & Insights ---"
test_get "/api/insights"
test_get "/api/pipeline/analytics"
test_get "/api/dashboard/summary"

# ==========================================
# SECTION 18: IMPORT / EXPORT
# ==========================================
echo ""
echo "--- SECTION 18: Import / Export ---"
test_get "/api/export?type=contacts&format=json"
test_get "/api/export?type=companies&format=json"
test_get "/api/export?type=deals&format=json"
test_get "/api/export?type=contacts&format=csv"
test_get "/api/export?format=json"

# Import CSV
CSV_DATA="firstName,lastName,email,company\nImport1,Test,import1@test.com,ImportCorp\nImport2,Test,import2@test.com,ImportCorp"
test_post "/api/import" "csvData=$CSV_DATA&type=contacts" "200" "application/x-www-form-urlencoded"

# ==========================================
# SECTION 19: GDPR
# ==========================================
echo ""
echo "--- SECTION 19: GDPR ---"
test_get "/api/gdpr/export"
# Don't actually delete — just test the endpoint responds
# test_post "/api/gdpr/delete" '{"confirm":"yes"}'

# ==========================================
# SECTION 20: TAM
# ==========================================
echo ""
echo "--- SECTION 20: TAM ---"
test_get "/api/tam"
test_post "/api/tam" '{"icp":"B2B SaaS companies with 10-50 employees in fintech"}'

# ==========================================
# SECTION 21: OUTBOUND REVIEW
# ==========================================
echo ""
echo "--- SECTION 21: Outbound Review ---"
test_get "/api/outbound/review"

# ==========================================
# SECTION 22: UNSUBSCRIBE
# ==========================================
echo ""
echo "--- SECTION 22: Unsubscribe ---"
test_get "/api/unsubscribe?email=test@test.com&list=test"
test_post "/api/unsubscribe" '{"email":"unsub-test@test.com","reason":"E2E test"}'

# ==========================================
# SECTION 23: ALL PAGES (authenticated)
# ==========================================
echo ""
echo "--- SECTION 23: All Pages ---"
# Dashboard pages
test_page "/"
test_page "/accounts"
test_page "/contacts"
test_page "/opportunities"
test_page "/chat"
test_page "/tasks"
test_page "/notes"
test_page "/meetings"
test_page "/deliverability"
test_page "/sequences"
test_page "/pricing"

# Settings pages
test_page "/settings"
test_page "/settings/workspace"
test_page "/settings/agent"
test_page "/settings/billing"
test_page "/settings/data-model"
test_page "/settings/knowledge"
test_page "/settings/mailboxes"
test_page "/settings/members"
test_page "/settings/notifications"
test_page "/settings/stages"
test_page "/settings/workflows"

# Legal pages (public)
test_page "/privacy"
test_page "/terms"
test_page "/acceptable-use"

# Auth pages
test_page "/sign-in"
test_page "/sign-up"
test_page "/landing"

# Detail pages (need real IDs)
if [ -n "$ACCOUNT_ID" ]; then
  test_page "/accounts/$ACCOUNT_ID"
fi
if [ -n "$CONTACT_ID" ]; then
  test_page "/contacts/$CONTACT_ID"
fi
if [ -n "$DEAL_ID" ]; then
  test_page "/opportunities/$DEAL_ID"
fi
if [ -n "$SEQ_ID" ]; then
  test_page "/sequences/$SEQ_ID"
fi

echo ""
echo "=========================================="
echo "  RESULTS SUMMARY"
echo "=========================================="
echo "PASSED: $PASS"
echo "FAILED: $FAIL"
echo "TOTAL:  $((PASS + FAIL))"
echo ""

if [ $FAIL -gt 0 ]; then
  echo "=========================================="
  echo "  FAILURES:"
  echo "=========================================="
  echo -e "$ERRORS"
fi

# Write results to file
cat > /tmp/e2e-full-results.txt << RESULTS_EOF
# E2E Full Test Results — $(date)

## Summary
- PASSED: $PASS
- FAILED: $FAIL
- TOTAL: $((PASS + FAIL))

## All Results
$(echo -e "$RESULTS")

## Failures
$(echo -e "$ERRORS")
RESULTS_EOF

echo ""
echo "Full results saved to /tmp/e2e-full-results.txt"
