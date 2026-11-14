# Local backend and console sign-in repair

Verified 21 October 2026, Asia/Kolkata. Local development only. No hosted database, deployment, production credential or real email delivery was used.

## Result

- New explicitly owned Supabase project: `letbuyy-web-local-20261021`.
- All 298 original migrations applied, highest version 369; source migration files were not edited.
- Console, canonical identity issuer and all four Workers are running.
- Actual browser sign-in with the requested local administrator reached `/dashboard` and rendered **Leadership Home**, with no API-unavailable panels.
- Wrong TOTP was rejected; real configured TOTP was accepted; reused magic proof was rejected; anonymous dashboard access was denied.

## Why startup failed

The installed Supabase PostgreSQL 17 image has a non-superuser `postgres` role. Migration 347's function-level custom settings require elevated migration-owner privileges. Later migrations also take explicit catalog locks and validate exact predecessor profiles; simply skipping 347 would not have repaired the database.

The local stack was therefore started from a separate ignored configuration with automatic migrations/seeds disabled, and existing source migrations were replayed in controlled maintenance sessions. Application services were stopped for replay. Every successful migration was acknowledged in `supabase_migrations.schema_migrations` and its source hash recorded under the local setup logs.

Local maintenance preparation:

1. Temporarily elevated the new cluster's migration owner `postgres`, restoring `NOSUPERUSER` after every replay attempt, including failures.
2. Removed extra `anon`, `authenticated` and `service_role` memberships from `postgres` and `supabase_realtime_admin`, matching migration 360's explicit accepted role graph. Existing `app_tenant` memberships and authenticator memberships were retained. This narrowed access; application roles were not elevated.
3. Narrowed `service_role` privileges on the private migration journal to canonical SELECT-only. PostgreSQL 17's added MAINTAIN privilege was part of the unrecognized fresh-image default ACL.
4. Temporarily paused six provider schema-refresh/extension helper callbacks during offline guarded DDL: `issue_graphql_placeholder`, `pgrst_ddl_watch`, `pgrst_drop_watch`, `issue_pg_cron_access`, `issue_pg_net_access`, `issue_pg_graphql_access`. All were restored enabled afterward. The application `subscription_tax_ddl_guard_360` was left enabled. No application guard, RLS policy or constraint was disabled.
5. Restarted services and reloaded the PostgREST schema cache.

Fresh reads confirmed 298 history entries, maximum 369, `postgres.rolsuper=false`, non-superuser application roles, and enabled provider helpers/application guard. The original unmodified one-command Supabase bootstrap remains incompatible with these source migration assumptions; this is a verified local maintenance procedure, not a general hosted migration repair or deployment certificate.

## Console configuration and account

The owner-requested email was provisioned only in this local database through the canonical `users_custom` and `super_admin_allowlist` tables. Its local allowlist is configured in identity, console and gateway ignored environment files. No production account was created and no claim of remote inbox ownership was made.

The generated templates contained unusable identity key placeholders and `accounts.example.com` origins. A new ES256 private key is configured only in `apps/platform/identity/.env.local`; console and Workers receive only its public JWKS. The local issuer and identity transport origin are `http://localhost:9002`. Prior environment files were preserved under `.tmp/local-backend/env-before-console-repair/`. These ignored files contain secrets and must not be committed or shared.

Worker templates also labelled local execution as staging. The resulting non-local admission budget caused session verification to return 429 immediately after accepted MFA during a burst of sign-in testing. Local `.dev.vars` now identify execution as `development`; production configuration and deployed limits were untouched. Durable session validation, TOTP matching/anti-replay, and magic-link single-use checks remain active.

The factor was not locked and did not require a reset. No approval records were fabricated, no principal factor metadata was manually cleared, and the canonical approved factor-reset workflow was not bypassed. This setup retains the repository's existing **local-only** development MFA code; verification additionally exercised its actual configured TOTP rather than relying on that code as production proof.

## Running endpoints

| Surface | URL |
|---|---|
| Console sign-in | http://localhost:9007/login |
| Identity | http://localhost:9002 |
| API gateway | http://localhost:9010/health |
| Mobile BFF | http://localhost:9011/health |
| Webhook Worker | http://localhost:9012/health |
| Queue Worker | http://localhost:9013/health |
| Supabase API | http://127.0.0.1:54321 |
| Supabase Studio | http://127.0.0.1:54323 |
| Local email capture | http://127.0.0.1:54324 |

All four Worker health endpoints returned HTTP 200. Supabase DB, API proxy, Auth, Storage, Studio, pooler, metadata, email capture and Realtime reported healthy; REST and Edge Runtime were running. Realtime business subscriptions, shipping, payments and external provider behavior were not exercised by these health checks.

## Restart and preservation

From the repository root:

```sh
source /Users/saai_mithra/.local/share/letbuyy/web-env.sh
supabase start --workdir .tmp/local-backend
pnpm exec turbo run dev --concurrency=7 --filter=@letbuyy/admin-web --filter=@letbuyy/identity-platform --filter=@letbuyy/api-gateway --filter=@letbuyy/mobile-bff --filter=@letbuyy/webhook-service --filter=@letbuyy/queue-workers
```

The processes are currently running. Do not start a duplicate supervisor on the same ports. Docker volumes hold the initialized database; preserve them and `.tmp/local-backend/supabase/config.toml`. Do not use `db reset`, remove volumes, or overwrite ignored environment files with `dev:setup --force` as routine startup. Automatic migration replay remains disabled in this local config: future schema changes require controlled application to this identified database, not a destructive reset.

Sensitive setup logs, replay acknowledgements and scripts are under `/tmp/letbuyy-web-setup/`; that location is temporary and must not be treated as a durable backup. Sanitized auth/dashboard verification JSON and a local screenshot are under `.tmp/local-backend/`. These observations establish this local console journey, not whole-project acceptance or production migration compatibility.
