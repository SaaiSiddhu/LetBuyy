# LetBuyy — Environment Setup Report

## Date

2026-05-31

## Executive Status

The repository is prepared for isolated staging and production deployment automation, but live cloud resource creation, migrations, deployment, and smoke tests were skipped because LetBuyy-scoped provider credentials and materialized infrastructure IDs were not available in this runtime. The completed work includes Cloudflare Wrangler environment configuration for active workers, Supabase and Vercel deployment config, GitHub Actions CI/CD workflows, setup scripts, inventories, and skip logs with exact resume points.

## Resources Created

### Repository Configuration

- Worker inventory: `docs/env-setup/workers-inventory.md`
- Next.js app inventory: `docs/env-setup/apps-inventory.md`
- Environment variable master list: `docs/env-setup/env-master-list.md`
- Skip log: `tasks/env-setup-skips.md`
- Cloudflare resource naming map: `config/cloudflare/resource-names.json`
- Supabase environment configs: `config/supabase/staging.json`, `config/supabase/production.json`
- Vercel project map: `config/vercel/projects.json`
- Staging and production env examples: `config/env/staging.env.example`, `config/env/production.env.example`
- Canonical staging/production secret matrix: `config/env/staging-production-secret-matrix.json`

### Cloudflare

- Account ID: not materialized; `CLOUDFLARE_ACCOUNT_ID_PLACEHOLDER` remains in config.
- Active workers configured for staging and production:
  - `services/api-gateway`
  - `services/webhook-service`
  - `services/queue-workers`
- Worker environments prepared: 3 staging + 3 production.
- KV namespaces planned: 6 total.
- R2 buckets planned: `letbuyy-media-staging`, `letbuyy-media-production`.
- Queues planned for active worker wiring.
- Hyperdrive connections planned: 2.
- Live resource creation: skipped. See `tasks/env-setup-skips.md`.

### Supabase

- Staging project config prepared: `letbuyy-staging`.
- Production project config prepared: `letbuyy-production`.
- Project refs and keys: placeholders remain.
- Migrations applied: 0 in this run.
- Urban Kicks seed applied: no, skipped because Supabase projects were not created.

### GitHub

- CI workflow prepared: `.github/workflows/ci.yml`.
- Staging deployment workflow prepared: `.github/workflows/deploy-staging.yml`.
- Production deployment workflow prepared: `.github/workflows/deploy-production.yml`.
- Repository setup script prepared: `scripts/github/setup-repo.mjs`.
- Secret setup script prepared: `scripts/github/set-secrets.mjs`.
- Live repo and secret setup: skipped because the active GitHub token is invalid and no replacement `GITHUB_TOKEN` is available.

### Vercel

- App configs prepared with Mumbai region and security headers:
  - `apps/identity-platform/vercel.json`
  - `apps/merchant-control-plane/vercel.json`
  - `apps/storefront-runtime/vercel.json`
  - `apps/app-marketplace/vercel.json`
  - `apps/theme-marketplace/vercel.json`
  - `apps/marketing-site/vercel.json`
  - `apps/platform-console/vercel.json`
  - `apps/platform-operations-portal/vercel.json`
- Vercel CLI repaired to `54.4.1`.
- Projects created: 0 in this run.
- Live deployments: skipped because no LetBuyy `VERCEL_ORG_ID` or project credentials were available.

## Verification Performed

- `pnpm run validate:governance` passed after every completed or skipped phase.
- `CI=true pnpm install --frozen-lockfile` completed after network escalation.
- `pnpm turbo build` passed after network escalation for external font fetches.
- Generated build artifacts were cleaned before commits.

## How to Deploy Going Forward

1. Authenticate or set provider credentials:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `SUPABASE_ACCESS_TOKEN`
   - Supabase organization id
   - `GITHUB_TOKEN`
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
2. Resume at Phase 5.2 in `tasks/env-setup-skips.md`.
3. Create Cloudflare, Supabase, GitHub, and Vercel resources.
4. Run `scripts/cloudflare/update-wrangler-ids.mjs` with real IDs.
5. Run Supabase migrations and seeds.
6. Push to `develop` for staging deployments.
7. Push to `main` for production deployments.

## Branch Deployment Model

- `develop` deploys to staging through `.github/workflows/deploy-staging.yml`.
- `main` deploys to production through `.github/workflows/deploy-production.yml`.

## Skipped Items

The authoritative skip list is maintained in `tasks/env-setup-skips.md`. Major skipped groups:

- Reserved worker roots without deployable source.
- Cloudflare resource creation and Worker secret setup.
- Supabase project creation, migrations, and Urban Kicks seed.
- GitHub repository/secret setup.
- Vercel project creation and deployments.
- Staging and production smoke tests.

## Final Assessment

The codebase is deployment-prepared, not live-deployed. The remaining work is credentialed infrastructure execution starting at Phase 5.2, followed by migrations, staging deployment, staging smoke tests, production deployment, and production smoke tests.
