# Audit-2026-05-08 — executable scripts

Two scripts that graduate the remaining audit layers from
"checklist + manual checks" to "press button, get verdict".

## `l6-smoke.sh` — production smoke against a deploy preview

```bash
bash _specs/AUDIT-2026-05-08/scripts/l6-smoke.sh https://leads-git-audit.vercel.app
```

What it asserts (each printed PASS / FAIL on stdout) :

- `/` returns 200 on the preview URL.
- The CSP response header contains the two PostHog EU hosts on
  `connect-src` AND `eu-assets.i.posthog.com` on `script-src`.
- The CSP keeps the security-hardening primitives (`frame-ancestors 'none'`,
  `object-src 'none'`).
- The brand string "Elevay" appears in the landing body.
- No "LeadSens" leak in the rendered body (memory check).
- No 5xx error string in the rendered body.
- `/sign-in`, `/sign-up` return 200.
- Auth-gated surfaces (`/home`, `/onboarding-v3`, `/sequences/review`,
  `/opportunities`, `/chat`, `/settings/llm-evals`) return 200/302/307
  (rendered or redirected to sign-in — both acceptable).
- `/api/inngest` returns 200 or 401 (responsive).

Exit code : `0` PASS / `1` FAIL.

Evidence written to
`_reports/audit-2026-05-08/L6-prod-smoke/post-deploy/` :
- `headers-root.txt` — full response headers
- `body-root.html` — full landing body
- `SUMMARY.md` — verdict + manual follow-up list

What this script does NOT cover (needs a browser session) :
- PostHog dashboard event window
- Session replay
- Person profile traits
- Triggering a real boundary error

These are listed in the SUMMARY.md output as manual follow-ups.

## `l7-weekly.sh` — behavioural cron-fired side-effect verification

```bash
DATABASE_URL=postgresql://... bash _specs/AUDIT-2026-05-08/scripts/l7-weekly.sh
```

Runs every Tuesday morning (Monday's eval cron has had a full day to
land its rows). Read-only SELECTs against production — no writes.

What it asserts :

| Check | Hard threshold |
|---|---|
| F4 weeklyEvalHarness landed rows | `llm_eval_runs` ≥ 1 since week start |
| F2 transcript-freshness ran | INFO-level (worker may not call LLM if nothing degraded) |
| F7 cronExpireSequenceDrafts firing | 0 drafts stuck `pending_approval` >72h |
| F7 draftRejectionLearner accumulating | If rejections > 0, sequences with `rejectionInsights` > 0 |
| F8 visitor_id monthly window | INFO-level — surfaces this-month vs last-month counts |
| F8 dedup ratio (rough) | INFO-level — visits 7d vs unique identified |
| F4 per-case rows | If eval runs > 0, per-case rows > 0 |

Exit code : `0` PASS / `1` FAIL.

Evidence written to
`_reports/audit-2026-05-08/L7-behavioural/<DATE>.md` — one log per
weekly run. The directory accumulates over time, so a 4-week trend
of PASS/FAIL is visible at a glance.

## When to run

- **L6** : right after `git push origin main` and Vercel produces a
  preview URL. Run again after prod deploy if you go straight to
  prod (the script doesn't care about the URL — pass whichever you
  want to verify).

- **L7** : Tuesday mornings for the next 4 Tuesdays after deploy.
  After 4 PASSes the audit is fully closed and you can retire the
  weekly run (or keep it as a permanent monitoring cron).
