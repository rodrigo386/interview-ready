# InterviewReady

AI-powered interview prep SaaS. Turns any CV + job description into a personalized, interactive interview prep guide with company intel, ATS gap analysis, and mock interview chat.

See `ARCHITECTURE.md` for the product vision and full stack design. See `docs/superpowers/specs/` and `docs/superpowers/plans/` for sub-project specs and implementation plans.

## Current status

**Sub-project #1 (Foundation):** auth, protected dashboard, Railway deploy.

## Local development

### Prerequisites

- Node.js 20 LTS
- pnpm 9.12+ (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker Desktop (for local Supabase stack)

### Setup

```bash
pnpm install
cp .env.example .env.local

# Start local Supabase (Postgres + Auth + Storage in Docker)
pnpm exec supabase start

# Copy the `anon key` and `service_role key` printed by `supabase start` into .env.local.
# Also set:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_APP_URL=http://localhost:3000

pnpm dev
```

Open http://localhost:3000.

### Running tests

```bash
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # E2E smoke test (Playwright, requires Supabase running)
pnpm lint
pnpm typecheck
```

### Stopping local Supabase

```bash
pnpm exec supabase stop
```

## Deployment

Auto-deployed to Railway on push to `main`. See `docs/superpowers/specs/2026-04-20-foundation-design.md` §8 for deploy architecture.
