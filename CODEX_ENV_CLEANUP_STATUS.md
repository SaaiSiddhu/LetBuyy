# ENV CLEANUP STATUS

Updated: 2026-06-04T10:27:21Z

## Result

The local development environment has been removed from the repo model. LetBuyy now documents and configures two supported environments only: `staging` and `production`.

## Completed

- Deleted tracked local environment/template/runtime artifacts, including `config/env/templates/local.env.example`, local Flutter defines, local stack scripts, local infrastructure, dev Cloudflare bootstrap, dev workflow, and local operational proof runner/test.
- Removed untracked `.env.local`, `.dev.vars`, and `.dart-defines.local` files from the workspace.
- Removed root/app/service `dev`, `local:*`, `federation:local:*`, and `setup:env` package scripts.
- Added `scripts/staging/seed.mjs`, which requires explicit staging database credentials and refuses localhost/loopback database URLs.
- Collapsed worker Wrangler configs to `[env.staging]` and `[env.production]` only.
- Repointed source fallback URLs and E2E contracts to staging URLs.
- Rewired lifecycle/workflow/governance docs to staging-first proof.
- Replaced the local-development runbook with `docs/runbooks/staging-development-lifecycle.md`.
- Patched mission docs so REAL-E2E proof means staging/preview deployment and staging Supabase/API, not `federation:local:up`.

## Verification

- `pnpm turbo typecheck` - PASS, 58/58 tasks.
- `pnpm lint` - PASS with existing warnings.
- `pnpm turbo build` - PASS, 58/58 tasks after rerun outside sandbox for Turbopack process permissions.
- `pnpm run validate:governance` - PASS, 128/128 validators.
- Targeted Node tests - PASS.
- Inventory scans - PASS: no local env/define files, no local/dev scripts, no dev Wrangler env/routes, no localhost app/service source fallbacks.

## SKIP - NEEDS HUMAN

- Populate Vercel, Cloudflare, GitHub Environment, Supabase, and provider secret stores for staging and production.
- Execute the first staging deploy and staging E2E/J1-J5 proof after secrets are present.
- Run `scripts/staging/seed.mjs` against a real staging database after `STAGING_DATABASE_URL` or `SUPABASE_STAGING_DATABASE_URL` is provided.
- Inject mobile signing/material provider keys through CI/platform stores for mobile release proof.

## Intentional Localhost Guardrails

The only remaining localhost references in source-controlled active paths are guards that reject loopback values or reserve `localhost` as a forbidden tenant subdomain.
