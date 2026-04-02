# LeadSens API Documentation

All endpoints require authentication via NextAuth session cookie unless otherwise noted.

## Authentication

Requests must include a valid NextAuth session cookie. API routes check authentication via:
```ts
const session = await auth();
if (!session?.user) return 401;
```

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://app.elevay.dev/api`

---

## Accounts

### GET /api/accounts
List all accounts for the current tenant.

**Response**: `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Acme Corp",
    "domain": "acme.com",
    "industry": "Technology",
    "size": "51-200",
    "score": 8.5,
    "scoreReasons": [...],
    "properties": {},
    "createdAt": "2026-04-01T00:00:00Z"
  }
]
```

### POST /api/accounts
Create a new account.

**Body**:
```json
{
  "name": "Acme Corp",
  "domain": "acme.com",
  "industry": "Technology"
}
```

### GET /api/accounts/:id
Get account details.

### PUT /api/accounts/:id
Update an account.

### GET /api/accounts/:id/contacts
List contacts for an account.

### GET /api/accounts/:id/lifecycle
Get account lifecycle/activity timeline.

### GET /api/accounts/:id/suggested-contacts
Get AI-suggested contacts for the account.

---

## Contacts

### GET /api/contacts
List all contacts. Supports query params: `?search=`, `?companyId=`, `?limit=`, `?offset=`.

### POST /api/contacts
Create a new contact.

**Body**:
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@acme.com",
  "title": "VP Engineering",
  "companyId": "uuid"
}
```

### GET /api/contacts/:id
Get contact details.

### PUT /api/contacts/:id
Update a contact.

---

## Deals / Opportunities

### GET /api/deals
List all deals. Supports `?stage=`, `?companyId=`.

### POST /api/deals
Create a new deal.

**Body**:
```json
{
  "name": "Acme Enterprise Deal",
  "companyId": "uuid",
  "contactId": "uuid",
  "stage": "qualification",
  "value": 50000,
  "currency": "USD"
}
```

### GET /api/opportunities/:id
Get deal details.

### PUT /api/deals/:id
Update a deal.

---

## Pipeline Analytics

### GET /api/pipeline/analytics
Get pipeline metrics.

**Response**:
```json
{
  "totalDeals": 42,
  "activeDeals": 28,
  "totalPipelineValue": 850000,
  "wonValue": 120000,
  "winRate": 0.35,
  "avgDealValue": 20238,
  "avgVelocityDays": 32,
  "valueByStage": {...},
  "funnel": [...],
  "riskSummary": {...}
}
```

---

## Chat (AI)

### POST /api/chat
Streaming AI chat endpoint.

**Body**:
```json
{
  "messages": [
    { "role": "user", "content": "Show me deals closing this month" }
  ],
  "threadId": "uuid"
}
```

**Response**: Server-Sent Events (SSE) stream of AI response chunks.

---

## Sequences (Outbound)

### GET /api/sequences
List all sequences.

### POST /api/sequences
Create a new sequence.

### GET /api/sequences/:id
Get sequence details with steps and enrollments.

### POST /api/sequences/:id/steps
Add/update steps.

### POST /api/sequences/:id/enroll
Enroll contacts in a sequence.

### POST /api/sequences/:id/autopilot
Toggle autopilot mode.

### GET /api/sequences/:id/suggestions
Get AI-generated step suggestions.

---

## Enrichment

### POST /api/enrich
Enrich a company using Apollo.io.

**Body**:
```json
{ "domain": "acme.com" }
```

### POST /api/enrich-contacts
Enrich contacts for a company.

---

## Email

### GET /api/email/status
Check Gmail connection status.

### POST /api/email/sync
Trigger email sync from Gmail.

### POST /api/emails
Generate AI-powered cold outreach email.

### POST /api/emails/follow-up
Generate follow-up email.

### POST /api/emails/suggest-reply
Get AI reply suggestion.

---

## Outbound

### GET /api/outbound/review
Get emails pending review.

### POST /api/outbound/review
Approve/reject outbound emails.

---

## Deliverability

### GET /api/deliverability
Get deliverability metrics (bounce rates, health scores).

---

## Settings

### GET/PUT /api/settings/workspace
Workspace configuration.

### GET/PUT /api/settings/stages
Pipeline stage configuration.

### GET/PUT /api/settings/data-model
Custom fields configuration.

### GET/PUT /api/settings/knowledge
AI knowledge base configuration.

### GET/PUT /api/settings/mailboxes
Connected mailbox management.

### GET/PUT /api/settings/custom-signals
Custom signal configuration.

---

## Billing

### POST /api/billing/checkout
Create Stripe checkout session.

**Body**:
```json
{ "priceId": "price_xxx" }
```

**Response**:
```json
{ "url": "https://checkout.stripe.com/..." }
```

### POST /api/billing/portal
Create Stripe customer portal session.

**Response**:
```json
{ "url": "https://billing.stripe.com/..." }
```

### GET /api/billing/usage
Get current period usage stats.

**Response**:
```json
{
  "period": { "start": "2026-04-01", "end": "2026-05-01" },
  "usage": {
    "api_call": 142,
    "email_sent": 38,
    "contact_enriched": 25,
    "ai_query": 89
  }
}
```

---

## GDPR

### GET /api/gdpr/export
Export all tenant data as JSON. Requires authentication.

### POST /api/gdpr/delete
Delete all tenant data. Requires `{ "confirm": "DELETE_ALL_DATA" }`.

---

## Unsubscribe (Public)

### GET /api/unsubscribe?email=&tenant=&token=
One-click email unsubscribe. No authentication required. Token is HMAC-SHA256 verification.

---

## Webhooks

### POST /api/webhooks/stripe
Stripe webhook handler. Verifies signature via `STRIPE_WEBHOOK_SECRET`.

### POST /api/webhooks/emailengine
EmailEngine webhook handler for bounce/reply events.

### POST /api/inngest
Inngest webhook endpoint for async job processing.

---

## Dashboard

### GET /api/dashboard/summary
Dashboard summary metrics.

---

## Search

### POST /api/search
Semantic search across contacts, accounts, deals.

### POST /api/search/tam
Search TAM (Total Addressable Market).

---

## Signals

### GET /api/signals
Get signals for accounts (job postings, funding, tech stack changes).

---

## Tasks

### GET/POST /api/tasks
List/create tasks.

---

## Activities

### GET /api/activities
List activities for an entity.

---

## Notes

### GET/POST /api/notes
List/create notes.

---

## Health

### GET /api/health
Health check endpoint. No authentication required.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-04-01T12:00:00Z",
  "version": "0.1.0"
}
```

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "error": "Human-readable error message"
}
```

Common status codes:
- `400` - Bad request (missing/invalid params)
- `401` - Unauthorized (no valid session)
- `404` - Resource not found
- `500` - Internal server error
