# CODEX REMEDIATION STATUS

Status: `BLOCKED — AWAITING HUMAN`
Date: 2026-06-05
Branch: `stream/letbuyy-remediation`

## Local Result

No unblocked local remediation work remains from the P0 through P4 remediation mission.

Local code, schema, docs, validators, and source-level regression suites have been updated through:

- P0 customer-session, password-reset, password-set intent, CSRF, customer-auth rate-limit, and Turnstile controls.
- Release-safety fail-closed workflow, secrets-before-deploy ordering, migration diff/backup evidence, production feature gates, and release smoke suite wiring.
- P1 cost controls for request-log sampling, cron no-op, Worker log sampling, atomic rate limiting, queue batching, GraphQL bulk single-path behavior, and Hyperdrive pooled-read decision.
- P2 performance work for storefront edge cache, pooled SQL reads, de-hot product view counts, keyset pagination, trigram search, async export/import, and checkout deferral.
- P3 scalability work for GraphQL fan-out mitigation, queue storm controls, projection reads, partition/retention migrations, dual-model reconciliation, and WS11-13 local rollout gates.
- P4 product work for multi-template theme editor drafts, GraphQL cart loud unsupported behavior, developer capability messaging, API-route ownership validation, developer-portal deployment alignment, and the Shopify-depth roadmap.

## Why This Is Not COMPLETE

The mission definition reserves `COMPLETE` for proven P0 and release-safety gates against deployed staging/production evidence. Those gates require human-controlled secrets, protected GitHub environments, live Supabase access, staging data, provider dashboards, and deployment authority. They are logged in `CODEX_REMEDIATION_LEDGER.md` under `SKIPPED — NEEDS HUMAN`.

The exact remaining gates are:

- Provision and verify live `CUSTOMER_SESSION_SECRET`, `TURNSTILE_SECRET_KEY`, and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- Apply migrations `077`, `078`, `079` through `089` in the approved staging/prod sequence, including backup, restore, dry-run, and maintenance-window proofs where required.
- Execute the production workflow with one required credential intentionally unset and confirm hard failure in `release-preflight`.
- Provision `PRODUCTION_BACKUP_ARTIFACT_PASSPHRASE` and validate encrypted backup restore evidence.
- Run the real-stack release smoke suite with `LETBUYY_E2E_REQUIRE_REAL_STACK=1` against deployed staging and production.
- Configure provider-backed Cloudflare Logpush/error export evidence.
- Capture representative staging performance proofs for trigram search, async export/import, checkout deferral, queue storm controls, analytics/search projections, partition cutover, and dual-model reconciliation.
- Deploy WS11-13 to staging with feature flags enabled, run the deployed GraphQL, app-platform, theme-engine, and extension quality suites, then graduate production cohorts with flags still default-off until accepted.
- Apply `087_theme_template_drafts.sql` to staging/prod and run deployed merchant editor save/publish smoke across product, collection, page, cart, and blog templates.

## Last Local Evidence

- `node --test tests/federation/developer-portal-capability-messaging.test.mjs tests/api-graphql/schema-contract.test.mjs tests/theme-engine/liquid-renderer-contract.test.mjs tests/app-platform/app-bridge.test.mjs` — PASS, 24/24 tests.
- `pnpm --filter @letbuyy/developer-portal typecheck` — PASS.
- `pnpm --filter @letbuyy/developer-portal lint` — PASS.
- `find apps services packages -maxdepth 3 \( -name node_modules -o -name dist -o -name tsconfig.tsbuildinfo \) -print | sort` — PASS, no generated workspace artifacts.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

## Resume Order

1. Start with the Phase 2 release-safety live gates: secrets, protected workflow failure proof, backup restore proof, and real-stack smoke.
2. Apply and prove the P0 auth migrations and Turnstile/customer-session deployed flows.
3. Run the staging performance/scalability proofs for migrations and queue/projection behavior.
4. Prove WS11-13 on deployed staging before any production feature-flag cohort graduation.
5. Run P4 deployed theme-editor proof after `087_theme_template_drafts.sql` is live.
