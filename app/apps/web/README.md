# LeadSens

The autonomous GTM engine for founder-led sales. Chat-first CRM with AI-powered outbound, auto-enrichment, and deal coaching.

## Tech Stack

- **Framework**: Next.js 15 (App Router, React 19)
- **Database**: PostgreSQL (Supabase) with Drizzle ORM
- **Auth**: NextAuth v5 (Google OAuth + Credentials)
- **AI**: Claude (Anthropic) + OpenAI embeddings
- **Email**: EmailEngine + Google Workspace / Microsoft 365
- **Jobs**: Inngest (async workflows)
- **Styling**: Tailwind CSS v4 (dark theme)
- **Monorepo**: Turborepo + pnpm

## Architecture

```
app/
├── apps/
│   ├── web/          # Next.js frontend + API routes
│   └── worker/       # Background job processor (BullMQ)
├── packages/         # Shared packages
├── turbo.json        # Turborepo config
└── pnpm-workspace.yaml
```

### Key Directories (web app)

```
src/
├── app/
│   ├── (dashboard)/      # Protected dashboard routes
│   │   ├── accounts/     # Account management
│   │   ├── contacts/     # Contact management
│   │   ├── opportunities/# Deal pipeline
│   │   ├── sequences/    # Outbound sequences
│   │   ├── chat/         # AI chat interface
│   │   ├── settings/     # User & workspace settings
│   │   └── ...
│   ├── (legal)/          # Public legal pages (ToS, Privacy, AUP)
│   ├── api/              # API routes (30+ endpoints)
│   └── sign-in/          # Auth pages
├── components/           # Shared UI components
├── db/                   # Database schema & connection
├── inngest/              # Async job definitions
└── lib/                  # Utilities (logger, stripe, billing, etc.)
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database (Supabase recommended)
- Redis (for EmailEngine + BullMQ)
- Docker (for EmailEngine)

## Local Development

1. **Clone and install**:
   ```bash
   git clone <repo-url>
   cd leads/app
   pnpm install
   ```

2. **Configure environment**:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   # Fill in all required values
   ```

3. **Start services**:
   ```bash
   # Start EmailEngine + Redis
   docker compose -f ../../docker-compose.yml up -d

   # Run database migrations
   cd apps/web && pnpm drizzle-kit push

   # Start dev server
   cd ../.. && pnpm dev
   ```

4. **Access**: Open http://localhost:3000

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string (Supabase pooler) |
| AUTH_SECRET | NextAuth.js secret |
| GOOGLE_CLIENT_ID | Google OAuth client ID |
| ANTHROPIC_API_KEY | Claude API key |
| OPENAI_API_KEY | OpenAI API key (embeddings) |
| APOLLO_API_KEY | Apollo.io enrichment API |
| STRIPE_SECRET_KEY | Stripe billing |
| POSTHOG_KEY | PostHog analytics |

## Deployment

### Vercel (recommended)

1. Connect repo to Vercel
2. Set root directory to `app/apps/web`
3. Configure environment variables in Vercel dashboard
4. Deploy

### Manual

```bash
cd app/apps/web
pnpm build
pnpm start
```

## API Overview

All API routes are under `/api/`. Key endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/accounts | GET/POST | List/create accounts |
| /api/contacts | GET/POST | List/create contacts |
| /api/deals | GET/POST | List/create deals |
| /api/chat | POST | AI chat (streaming) |
| /api/sequences | GET/POST | List/create sequences |
| /api/enrich | POST | Enrich company data |
| /api/emails | POST | Generate outbound emails |
| /api/billing/checkout | POST | Create Stripe checkout |
| /api/billing/portal | POST | Stripe customer portal |
| /api/gdpr/export | GET | Export all user data |
| /api/gdpr/delete | POST | Delete all user data |
| /api/health | GET | Health check |

See [API Documentation](./API.md) for full details.

## Testing

```bash
cd app/apps/web
pnpm test          # Run unit tests
pnpm tsc           # Type check
pnpm lint          # Lint
```

## License

Proprietary - Elevay SAS
