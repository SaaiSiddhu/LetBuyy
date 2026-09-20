# LETBUYY V1 — DEPLOYMENT GAP REPORT
**Repository truth · HEAD `254af28c` · branch `stepup/main`**

Only **real** blockers are listed. Each is an external/operator action — no repository-side code blockers remain.

## Repository-side: 0 blockers
All five deploy-target apps build (`next build` → Compiled successfully), all runtime typechecks are 0, the governance gate is 107/107, the launch suite is 143/143, federation 99/99, money convergence 4/4, and every non-Docker test passes. Migrations are sequential through 174 with rollbacks.

## External / operator blockers (must be done outside the repo)

| # | Blocker | Evidence | Action |
|---|---------|----------|--------|
| 1 | **Branch not pushed** — local `stepup/main` is 200+ commits ahead of `origin/main`; CI/deploy cannot trigger. | `git rev-list --left-right --count origin/main...HEAD` | `git push origin` (operator authorization required). |
| 2 | **Production secrets not set** — the deploy workflow requires ~25 GitHub secrets; if absent, dependent paths fail closed. | `production-deploy.yml` preflight (`missing+=(...)`) + `wrangler secret put` block | Set `PRODUCTION_SUPABASE_*`, `PRODUCTION_AUTH_SECRET`, `PRODUCTION_CSRF_SECRET`, `PRODUCTION_CUSTOMER_SESSION_SECRET`, `PRODUCTION_STEP_UP_SIGNING_SECRET`, `PRODUCTION_IDENTITY_PUBLIC_JWKS`, `PRODUCTION_CHECKOUT_SIGNING_SECRET`, `PRODUCTION_TURNSTILE_SECRET_KEY`, `PRODUCTION_API_GATEWAY_INTERNAL_SECRET`, `PRODUCTION_QUEUE_TENANT_ENVELOPE_SECRET`, `PRODUCTION_UPSTASH_REDIS_REST_URL`, `PRODUCTION_RESEND_API_KEY`, `PRODUCTION_RAZORPAY_*`, `VERCEL_TOKEN`/`VERCEL_ORG_ID`. |
| 3 | **Migrations not applied to a live DB** — repo files only; gift cards/refund-restore/shipping/GST are nonfunctional until applied. | `production-deploy.yml` `migrate-production` → `supabase db push --include-all` (gated) | Runs automatically on deploy once `PRODUCTION_DB_CONNECTION_STRING` is set; applies 173 + 174. |
| 4 | **Live provider round-trips unverified** — Resend, Razorpay, Turnstile have no live credentials in-repo (by design). | `RESEND_API_KEY`/`RAZORPAY_KEY_SECRET`/`TURNSTILE_SECRET_KEY` env reads | Provide live keys via secrets; smoke a real order + refund + email on staging. |
| 5 | **DNS for storefront subdomains** — `{store}.letbuyy.com` + custom domains routed by `proxy.ts`. | `apps/storefront-runtime/src/proxy.ts` host routing | Configure DNS/wildcard at the registrar/Cloudflare. |
| 6 | **Docker/Postgres regression suite not run here** — 21 `*-postgres` tests need a live Postgres (RLS/ledger/migration replay). | `colima/docker.sock` unavailable in this environment | Run in CI/local with Docker before go-live. |

## Repository deployment wiring — present and verified
- **Workers:** `wrangler.toml` × 4 (api-gateway, queue-workers, webhook-service, mobile-bff) + `production-deploy.yml` build+secret+deploy steps.
- **Next apps:** Vercel deploy matrix (storefront, merchant, identity, marketing, platform-console) — all now build-clean.
- **Migrations:** gated `db push --include-all` with an untracked-migration guard.
- **Queues / KV / R2 / Hyperdrive:** bindings declared in the wrangler configs.
