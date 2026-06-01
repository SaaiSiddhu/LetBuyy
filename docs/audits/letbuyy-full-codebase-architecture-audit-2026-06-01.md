# LetBuyy Full Codebase Architecture Audit - 2026-06-01

## Scope And Source Basis

This audit covers the tracked repository state for LetBuyy Store and focuses on architecture, runtime boundaries, deployment readiness, and staging/production environment strategy.

Source basis:

- Inventory command: `git ls-files`.
- Tracked files audited: 2,453.
- Text files read by static audit pass: 2,364.
- Approximate tracked text lines read: 657,852.
- Major tracked source groups: `apps` 891 files, `packages` 415, `services` 112, `database` 94, `infrastructure` 80, `scripts` 150, `tests` 128, `config` 88, `docs/governance` 116.
- Runtime manifest roots inspected: all canonical web apps, mobile apps, `services/api-gateway`, `services/webhook-service`, `services/queue-workers`, and reserved service roots.
- Env source files inspected: `config/env/*`, `config/supabase/*`, service `wrangler.toml` files, Next app API clients, worker entrypoints, deployment scripts, and secret helper scripts.

No real secret values, production customer data, or provider credentials were read or recorded.

## Remediation Applied After Audit

The following items from this audit were fixed in the same follow-up pass:

- Added `config/env/staging-production-secret-matrix.json` and its schema as the canonical staging/production secret-manager contract.
- Expanded Next and Worker env schemas/templates to cover the actual staging/production variable names used by apps, workers, platform console, payments, and CI.
- Expanded `config/vercel/projects.json`, Vercel app configs, and deploy workflow matrices from 5 web apps to all 8 canonical web apps.
- Added Cloudflare domain ownership entries for `apps`, `themes`, and `ops` staging/production surfaces.
- Updated GitHub secret setup to provision environment-scoped staging and production secrets without printing values.
- Removed unused public Supabase env exposure from `apps/theme-marketplace/next.config.ts`.

## Current Architecture Truth

### Runtime Topology

LetBuyy is organized around the intended runtime split:

- Web apps: marketing, identity, merchant control plane, storefront runtime, app marketplace, theme marketplace, platform console, platform operations portal.
- Mobile apps: shopper, merchant, operator.
- Worker services: API gateway, webhook service, queue workers.
- Reserved service roots remain governed placeholders for analytics, checkout, event bus, media, notification, and search.
- Shared contracts and runtime logic are in `packages/*`, including `shared-types`, `api-client`, `auth-core`, `theme-engine`, `payments`, `event-core`, `app-engine`, and infrastructure adapters.

The Hono `services/api-gateway` is the effective backend front door. It mounts 31 route modules, including auth, storefront, stores, products, orders, payments, themes, app-store, operations, and internal-console.

### App Thinness

Positive findings:

- Static scan found 0 direct `@supabase/*` imports under web apps.
- The five federated web apps use `@letbuyy/api-client` and `@letbuyy/auth-core` server adapters.
- Merchant, storefront, app marketplace, theme marketplace, platform console, and operations portal all have API client wrappers that can target a `/v1` gateway.
- Service-role references are confined to infrastructure/worker-level code, except legacy utility package exports.

Remaining deviations:

- There are still 115 tracked Next app API route handlers under `apps/**/src/app/api/**/route.ts`.
- Route count by app: app marketplace 8, identity platform 18, merchant control plane 62, platform console 4, storefront runtime 21, theme marketplace 2.
- These routes mostly proxy to the gateway or handle app-local session/logout/identity flow, but they remain an architecture risk because app-local API surfaces can drift from the one Commerce API.
- `packages/typescript/utils/src/supabase.ts` still exposes Supabase utility functions. Even if web apps do not currently import it directly, it is a risky public package surface because `@letbuyy/utils` is used by apps.

### Identity And Auth

Positive findings:

- Shared session verification is centralized in `@letbuyy/auth-core`.
- Web app proxies and server API clients use the `lb_session` cookie and internal signed headers.
- Identity platform is the user-facing auth hub for redirects.

Remaining deviations:

- Identity platform still owns 18 Next auth/email route handlers.
- These handlers call gateway custom auth routes, but they also own CSRF handling, Turnstile handling, email initiation, local session cookie behavior, and some device/session logic.
- Platform console still has an internal console auth flow with `PLATFORM_CONSOLE_*` secrets and should be explicitly classified as ops-only, not merchant identity.

### Data And Database

Positive findings:

- Database authority is under `database/supabase`.
- Migration prefixes are unique in the tracked state.
- 72 tracked Supabase migration files exist, ending at `072_marketplace_review_records.sql`.
- Worker DB access goes through `@letbuyy/infrastructure/supabase-adapter` and gateway helper modules.

Remaining deviations:

- `config/supabase/staging.json` and `config/supabase/production.json` still contain placeholder project refs and keys.
- `scripts/supabase/run-migrations.mjs` refuses staging/production migration runs until those placeholders are replaced through secret/governed configuration.
- Mobile merchant app still uses Supabase Flutter directly. That is outside the web-app success criterion but conflicts with the broader "one API" direction for all surfaces.

### Payments And Webhooks

Positive findings:

- `@letbuyy/payments` exists as the common provider interface.
- Infrastructure adapters exist for Razorpay, Stripe, PayPal, Cashfree, PhonePe, UPI, and COD scaffolds.
- `services/webhook-service` verifies provider webhooks and persists payment webhook events.

Remaining deviations:

- Payment provider env ownership is split across worker templates, next app templates, and provider-specific code.
- Staging/production examples only list `NEXT_PUBLIC_RAZORPAY_KEY_ID`, but workers also require `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`.
- Stripe and PayPal are scaffolded in templates but should be disabled unless explicitly enabled per environment.
- `PAYMENT_CONFIG_ENCRYPTION_KEY` is required for store payment config writes and must be treated as a required worker secret for staging and production.

### Event Spine And Async Runtime

Positive findings:

- `@letbuyy/event-core`, outbox execution adapters, queue execution adapters, and `services/queue-workers` exist.
- API gateway produces to Cloudflare Queues via declared bindings.
- Queue workers persist queue deliveries and telemetry to Supabase-backed operational tables.

Remaining deviations:

- `queue-workers` `Env` extends `SupabaseServiceEnv`, so it needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, but that is not obvious from the `wrangler.toml` vars because secrets are not declared there.
- Real staging/prod queue and DLQ resources are named in `wrangler.toml`, but provisioning evidence is outside the repo and must be verified in Cloudflare.

## Staging And Production Env Strategy

### Policy

Staging and production are the only deployment targets.

"Local dev and staging should be same" means same shape only:

- Same env variable names.
- Same `/v1` API path behavior.
- Same app-to-gateway topology.
- Same worker bindings and queue naming pattern.
- Same provider modes where possible.

It must not mean reusing staging resources from a developer machine. Local execution may exist for developer readiness, but local is not a deployment target and must never mutate staging data accidentally.

### Secret Manager Ownership

Use secret managers only:

- Vercel project env vars for Next apps.
- Cloudflare Wrangler secrets and bindings for workers.
- Supabase project dashboard or API for staging/production project keys.
- Provider dashboards for Razorpay, Resend, Turnstile, Upstash, Stripe, and PayPal if enabled.
- GitHub Actions secrets only for CI/CD automation credentials and non-interactive deploy pipelines.

Do not commit `.env`, `.env.local`, `.dev.vars`, `all.env`, real Supabase JSON values, provider keys, or generated env files.

### Required Staging Secrets

Staging must use separate sandbox or non-production resources:

- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Internal auth: `AUTH_SECRET`, `CUSTOMER_SESSION_SECRET`, `INTERNAL_API_SECRET`, `LETBUYY_INTERNAL_API_SECRET`, `CSRF_SECRET`.
- Platform console: `PLATFORM_CONSOLE_ALLOWED_EMAILS`, `PLATFORM_CONSOLE_SESSION_SECRET`, `PLATFORM_CONSOLE_TOTP_SECRET`, `PLATFORM_CONSOLE_API_TOKEN`.
- Gateway payments: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PAYMENT_CONFIG_ENCRYPTION_KEY`.
- Public payments: `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
- Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- Bot protection: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.
- Rate/cache: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Optional providers only if enabled: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE=sandbox`.

### Required Production Secrets

Production must use separate live resources:

- Supabase production project keys and service role.
- Production-only generated internal secrets.
- Razorpay live `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
- Production Resend sender/domain configuration.
- Production Turnstile keys.
- Production Upstash Redis.
- Production `PAYMENT_CONFIG_ENCRYPTION_KEY`.
- Optional Stripe/PayPal live credentials only after explicit enablement and webhook verification.

Every staging secret and every production secret must differ, including generated internal secrets.

## Deployment Readiness Blockers

1. Supabase staging/production config is placeholder-only.
   - Evidence: `config/supabase/staging.json` and `config/supabase/production.json` contain placeholder project refs and keys.
   - Impact: migration and real-stack validation cannot certify staging or production.

2. Secret setup automation is incomplete.
   - Evidence: `scripts/github/set-secrets.mjs` covers identity, merchant, storefront, marketing, and console Vercel project ids, but not app marketplace, theme marketplace, or operations portal.
   - Impact: CI/CD can deploy a partial platform while leaving federated surfaces unconfigured.

3. App-local API routes remain widespread.
   - Evidence: 115 tracked app API routes under `apps/**/src/app/api/**/route.ts`.
   - Impact: one Commerce API discipline is not fully enforced even though routes increasingly proxy to the gateway.

4. Worker secrets are not represented in one complete staging/production matrix.
   - Evidence: worker templates include provider secrets, staging/production env examples omit several server-side worker secrets.
   - Impact: deployments can boot with missing payment, webhook, Redis, or Supabase bindings.

5. Local/development remains a governed environment in docs and `wrangler.toml`.
   - Evidence: `environment-lifecycle-governance.md`, `setup-local-env.mjs`, and worker `env.dev` sections still encode local/dev as lifecycle stages.
   - Impact: this conflicts with the owner's current intent that staging and production are the only deployment targets.

6. Mobile merchant app still has direct Supabase runtime coupling.
   - Evidence: Supabase Flutter imports and direct auth usage in `apps/mobile/merchant-app`.
   - Impact: broader "every surface through one API" federation is incomplete outside the web apps.

7. Public Supabase config still exists in browser-facing config paths.
   - Evidence: `apps/theme-marketplace/next.config.ts` exposes `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Impact: public anon values are not secrets, but their presence encourages app-local data coupling and should be removed if the marketplace is fully gateway-backed.

## Implementation Recommendations

### Phase A - Secret Manager Contract

- Create a single environment matrix for staging and production that lists every variable, owner, secret manager, and runtime consumer.
- Expand the existing staging/production examples to include all worker-required provider secrets.
- Expand CI secret setup to cover all eight web apps and all three active workers.
- Keep local templates, if retained, as staging-shaped sandbox examples only and mark them as non-deployment.

### Phase B - Deployment Topology Cleanup

- Keep Cloudflare `env.staging` and `env.production` as deployable targets.
- Reclassify `env.dev` and local scripts as developer-only, not a promotion stage.
- Do not point local defaults at staging resources by default.
- Require explicit operator opt-in for any local command that targets staging.

### Phase C - App API Surface Reduction

- Categorize the 115 app API routes into proxy, auth/session adapter, browser-only facade, and obsolete.
- Keep only thin browser/session adapters that cannot safely be called directly from the browser.
- Move all business/data routes to gateway routes and remove app route handlers after each domain is green.
- Preserve identity-platform route handlers only where they are truly account-hub browser adapters.

### Phase D - Provider And Webhook Hardening

- Make Razorpay required for staging and production.
- Keep Stripe and PayPal disabled unless their full secret set is configured.
- Require `PAYMENT_CONFIG_ENCRYPTION_KEY` before enabling payment settings writes.
- Verify webhook secrets in `services/webhook-service` for each active provider in staging before production.

### Phase E - Mobile/API Alignment

- Plan a separate mobile migration from Supabase Flutter auth/data calls to gateway-backed auth/API flows.
- Keep mobile public Supabase config only until that migration starts.
- Do not count mobile surfaces as fully federated until direct Supabase runtime calls are removed.

## Validation Plan

Static checks to run after env-contract edits:

- `pnpm run validate:governance`
- `pnpm run validate:cloudflare`
- `pnpm run validate:dependencies`
- `pnpm turbo typecheck`
- `pnpm lint`
- `pnpm turbo build`

Deployment dry runs to run after secrets and provider resources are configured:

- `pnpm --dir services/api-gateway exec wrangler deploy --config wrangler.toml --env staging --dry-run`
- `pnpm --dir services/webhook-service exec wrangler deploy --config wrangler.toml --env staging --dry-run`
- `pnpm --dir services/queue-workers exec wrangler deploy --config wrangler.toml --env staging --dry-run`

Staging smoke tests to require before production:

- Accounts login and session redirect across all web apps.
- Gateway `/health` and representative `/v1` storefront, auth, theme, app-store, payment, and operations endpoints.
- Razorpay test order creation plus webhook verification.
- Theme marketplace list, install, and storefront render.
- App marketplace list, OAuth install, app block render, billing ledger creation.
- Queue worker event delivery into Supabase operational tables.

## Residual Risk

- This audit is static and source-derived. It does not prove live staging or production readiness.
- Real staging/prod status depends on external secret stores, Cloudflare bindings, Supabase project state, provider dashboard configuration, DNS, and CI/CD project wiring.
- The current local browser login failure is consistent with missing API gateway Supabase env; the staging/production fix is secret-manager configuration, not committed local env files.
- Existing dirty worktree edits and untracked mission documents were not modified by this audit.
