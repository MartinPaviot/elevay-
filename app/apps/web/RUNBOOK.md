# LeadSens Production Runbook

## Deployment

### Standard Deploy (Vercel)
Merging to `main` triggers auto-deploy via Vercel. CI runs tests + type check before deploy.

### Manual Deploy
```bash
cd app/apps/web
pnpm build && pnpm start
```

### Rollback
1. Open Vercel dashboard > Deployments
2. Find the last known-good deployment
3. Click "..." > "Promote to Production"
4. Rollback completes in < 60 seconds

Alternative (git):
```bash
git revert HEAD
git push origin main
# Auto-deploys the revert
```

---

## Common Issues

### Database Connection Errors

**Symptom**: `ECONNREFUSED` or `connection terminated unexpectedly`

**Diagnosis**:
```bash
# Check Supabase status
curl https://wdgwytpaxuvgigqgzxrw.supabase.co/rest/v1/ -H "apikey: <anon-key>"
```

**Fix**:
1. Check Supabase dashboard for outages
2. Verify DATABASE_URL uses the pooler endpoint (port 6543, not 5432)
3. If connection pool exhausted, restart the Vercel deployment
4. If Supabase is down, wait for recovery (data is preserved)

### Auth Errors (NextAuth)

**Symptom**: Users can't sign in, redirect loops

**Fix**:
1. Verify `AUTH_SECRET` is set in production env
2. Verify `AUTH_URL` matches the production domain (https://app.elevay.dev)
3. Check Google OAuth redirect URIs in Google Cloud Console
4. Clear cookies and retry

### Gmail OAuth Token Expired

**Symptom**: Email sync fails, "invalid_grant" errors

**Fix**:
1. User needs to re-connect Gmail in Settings
2. The refresh token may have been revoked
3. Check if Google OAuth consent screen is in "Testing" mode (limited to test users)

### Inngest Jobs Not Running

**Symptom**: Enrichment/email jobs stuck, no background processing

**Fix**:
1. Check Inngest dashboard for function status
2. Verify INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY are set
3. Check /api/inngest endpoint is accessible
4. Retry failed functions from Inngest dashboard

### EmailEngine Down

**Symptom**: Outbound emails not sending, bounce/reply webhooks not firing

**Fix**:
1. Check Docker: `docker compose ps`
2. Restart: `docker compose restart emailengine`
3. Check Redis: `docker compose exec redis redis-cli ping`
4. Verify EMAILENGINE_SECRET matches

### Stripe Webhooks Failing

**Symptom**: Subscription changes not reflected in app

**Fix**:
1. Check Stripe dashboard > Webhooks > Recent events
2. Verify STRIPE_WEBHOOK_SECRET matches the endpoint secret
3. Ensure /api/webhooks/stripe is accessible from Stripe's IPs
4. Retry failed events from Stripe dashboard

### AI/LLM Errors

**Symptom**: Chat not responding, email generation failing

**Fix**:
1. Check Anthropic status page (status.anthropic.com)
2. Check OpenAI status page (status.openai.com)
3. Verify API keys are valid and have credits
4. Check rate limits (Anthropic: 1000 RPM, OpenAI: varies by tier)

### High API Costs

**Symptom**: Unexpectedly high AI API bills

**Diagnosis**:
1. Check PostHog for AI query volume
2. Check /api/billing/usage for per-tenant usage
3. Look for runaway loops in Inngest function logs

**Fix**:
1. Token budget per request is enforced (max_tokens in AI calls)
2. Identify the tenant with excessive usage
3. Temporarily disable their AI features if needed

---

## Monitoring Checklist

| Check | How | Frequency |
|-------|-----|-----------|
| App uptime | UptimeRobot / Vercel Analytics | Continuous |
| Error rate | Sentry dashboard | Daily |
| API response times | Vercel Analytics | Weekly |
| Database size | Supabase dashboard | Weekly |
| AI API costs | Anthropic/OpenAI dashboards | Weekly |
| Stripe revenue | Stripe dashboard | Weekly |
| Email deliverability | /deliverability page + Google Postmaster | Daily |

---

## Emergency Contacts

- **Infrastructure**: Martin (founder)
- **Supabase**: support@supabase.io
- **Vercel**: support@vercel.com
- **Stripe**: dashboard.stripe.com/support
- **Anthropic**: support@anthropic.com

---

## Secret Rotation

### Rotate AUTH_SECRET
1. Generate new secret: `openssl rand -base64 32`
2. Update in Vercel env vars
3. Redeploy
4. All existing sessions will be invalidated (users must re-login)

### Rotate API Keys
1. Generate new key in provider dashboard
2. Update in Vercel env vars
3. Redeploy
4. Verify functionality

### Rotate STRIPE_WEBHOOK_SECRET
1. Create new webhook endpoint in Stripe (or rotate secret)
2. Update STRIPE_WEBHOOK_SECRET in Vercel
3. Redeploy
4. Verify webhook delivery in Stripe dashboard

---

## Database Operations

### Run Migrations
```bash
cd app/apps/web
DATABASE_URL=<production-url> pnpm drizzle-kit push
```

### Backup
Supabase handles automated daily backups. For manual backup:
```bash
pg_dump <DATABASE_URL> > backup_$(date +%Y%m%d).sql
```

### Restore
```bash
psql <DATABASE_URL> < backup_20260401.sql
```
