# Staging Development Lifecycle Runbook

## Purpose

Deploy, validate, seed, and test the LetBuyy staging stack. Local emulators and localhost stacks are retired; staging is the development and test environment.

## Procedure

1. Ensure Vercel, Cloudflare, GitHub Environment, and Supabase staging secrets are populated from `config/env/staging-production-secret-matrix.json`.
2. Deploy the branch to the staging or PR preview web targets.
3. Deploy workers with the Cloudflare `staging` environment.
4. Run `node scripts/staging/seed.mjs` only with `STAGING_DATABASE_URL` or `SUPABASE_STAGING_DATABASE_URL`.
5. Run Playwright and J1-J5 journeys against the deployed staging URLs.

## Reset

Use a disposable staging Supabase project for fresh-database proof. Apply `database/supabase/migrations/000_baseline.sql`, then run the staging seeder with staging credentials.

## Evidence Boundary

Staging proves development and release readiness only. Production certification still requires provider-backed production evidence.
