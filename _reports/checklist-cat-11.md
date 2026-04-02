# Category 11: Unit Economics Audit

**Audited**: 2026-04-01
**Status**: IN PROGRESS — needs real API usage data after fake data replaced

---

## Item-by-item audit

### 11.1 Cost per client per month calculated with REAL API usage

#### Claude API
**Status**: ❌ NOT CALCULATED

**Evidence**: Claude Sonnet used for:
- Company enrichment (Inngest background) — ~500 tokens input + 200 tokens output per company
- Contact enrichment (Inngest background) — ~400 tokens input + 200 tokens output per contact
- Email generation — ~800 tokens input + 400 tokens output per email
- Reply classification — ~300 tokens input + 50 tokens output per reply
- Signal interpretation — ~600 tokens input + 300 tokens output per batch
- Chat conversations — variable, ~2000 tokens input + 500 tokens output per exchange
- TAM building (LLM fallback) — ~800 tokens input + 2000 tokens output per batch
- Deal analysis — ~1000 tokens input + 500 tokens output per deal

**Estimated per client/month** (assuming 500 contacts, 200 companies, 50 emails, 100 chats):
- Enrichment: ~700 calls × ~700 tokens avg = 490K tokens ≈ $1.47 input + $0.74 output = ~$2.21
- Email gen: 50 × 1200 tokens = 60K tokens ≈ $0.18 + $0.15 = ~$0.33
- Chat: 100 × 2500 tokens = 250K tokens ≈ $0.75 + $0.38 = ~$1.13
- **Subtotal: ~$3.67/client/month** (Claude Sonnet @ $3/M input, $15/M output)

**BUT**: If enrichment moves to Apollo (replacing LLM), Claude costs drop significantly. Enrichment would be ~$0 for Claude.

#### OpenAI Embeddings
**Status**: ❌ NOT CALCULATED

**Evidence**: `lib/embeddings.ts` uses OpenAI for vector embeddings. Every company and contact gets embedded.
- ~700 entities × ~200 tokens per entity = 140K tokens
- text-embedding-3-small: $0.02/M tokens
- **Subtotal: ~$0.003/client/month** (negligible)

#### Apollo/PDL
**Status**: ❌ NOT CALCULATED — depends on tier

**Evidence**: Apollo free tier gives ~100 credits/month. At 500 contacts + 200 companies = 700 enrichment calls:
- Free tier: $0 but only ~100 calls
- Basic ($49/mo): 900 credits — fits 1-2 clients
- Professional ($99/mo): 2400 credits — fits ~3 clients
- **Per client: $16-49/client/month** at Basic-Professional tiers

PeopleDataLabs: Not integrated. If added:
- $0.01-0.10 per enrichment call
- 700 calls/month: $7-70/client/month

#### Supabase
**Status**: ❌ NOT CALCULATED

**Evidence**: Pro plan ($25/mo) includes:
- 8GB database, 250GB bandwidth, 100GB storage
- At 100 clients × 500 contacts = 50K records + embeddings (~400MB pgvector)
- **Per client: ~$0.25/client/month** at 100 clients on Pro

#### Email sending infrastructure
**Status**: ❌ NOT CALCULATED — no sending implementation

**Evidence**: EmailEngine self-hosted is free. Google Workspace: $6/user/month per mailbox. If 2 mailboxes per client:
- **Per client: ~$12/client/month** for mailbox costs

#### Total COGS estimate
**Status**: ❌ NOT DOCUMENTED (estimated below)

| Service | Per Client/Mo | Notes |
|---------|--------------|-------|
| Claude API | ~$1.50 | After moving enrichment to Apollo |
| OpenAI embeddings | ~$0.01 | Negligible |
| Apollo enrichment | ~$16-49 | Biggest cost driver |
| Supabase | ~$0.25 | At 100 clients |
| Email mailboxes | ~$12 | 2 Google Workspace mailboxes |
| **Total COGS** | **~$30-63** | Range depends on Apollo tier |

### 11.2 Margin at $99/mo
**Status**: ❌ NOT CALCULATED (estimated)

- Best case (Apollo Basic shared): $99 - $30 = $69 margin (70%) ✅
- Worst case (Apollo Pro per client): $99 - $63 = $36 margin (36%) ❌

### 11.3 Margin at $199/mo
**Status**: ❌ NOT CALCULATED (estimated)

- Best case: $199 - $30 = $169 margin (85%) ✅
- Worst case: $199 - $63 = $136 margin (68%) ✅

### 11.4 Break-even: how many clients for fixed costs
**Status**: ❌ NOT CALCULATED

**Fixed costs estimate**:
- Supabase Pro: $25/mo
- Vercel Pro: $20/mo
- Domain + misc: $15/mo
- **Total fixed: ~$60/mo**
- Break-even at $99/mo: 1 client (fixed costs are low)

### 11.5 At 100 clients: total costs
**Status**: ❌ NOT CALCULATED

**Estimate**: 100 × $30-63 + $60 fixed = $3,060-6,360/mo
Revenue: 100 × $99 = $9,900/mo
Margin: 36-69%

### 11.6 At 1,000 clients: where does it break?
**Status**: ❌ NOT CALCULATED

**Potential breaks**:
- Apollo rate limits: 1000 clients × 700 calls = 700K enrichments/month — needs Enterprise tier
- Supabase: 500K contacts + embeddings — needs custom plan (~$100-500/mo)
- Email infrastructure: 1000 × 2 mailboxes = 2000 Google Workspace accounts — needs wholesale deal

### 11.7 Apollo/PDL rate limits at scale
**Status**: ❌ NOT DOCUMENTED

**Apollo limits**:
- Free: 100 credits/month, 10/min
- Basic ($49): 900 credits/month
- Professional ($99): 2400 credits/month
- Organization ($149+): 5000+ credits/month

At 100 clients: ~70K enrichments/month — needs Organization+ tier or caching strategy

### 11.8 Cost optimization documented
**Status**: ❌ NOT DOCUMENTED

**Optimization opportunities**:
1. Cache Apollo results — don't re-enrich same company/contact
2. Batch enrichment calls (Apollo supports bulk)
3. Use cheaper models for simple tasks (GPT-4o-mini vs Claude Sonnet)
4. Implement enrichment tiers (basic on signup, full on engagement)
5. Share Apollo credits across tenants for same companies

---

## Score: 0/8 items passing (all estimates, none documented with real data)
- ✅: 0
- ❌: 8

**Note**: Real calculations require replacing fake data with real APIs first, then measuring actual token/credit usage per operation.
