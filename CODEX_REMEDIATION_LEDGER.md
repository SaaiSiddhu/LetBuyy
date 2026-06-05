# CODEX REMEDIATION LEDGER

## CURRENT PHASE

- Phase: PHASE 5 — P3 Scalability.
- Current work item: P3-5 queue storm controls.
- Branch: `stream/letbuyy-remediation`.

## DONE

### P0-A.1 — Customer-session primitive

- Added `packages/auth-core/src/customer-session.ts`.
- Exported `issueCustomerSession`, `verifyCustomerSession`, and `LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS` from `@letbuyy/auth-core`.
- Session primitive uses Web Crypto HMAC-SHA-256, compact JWT shape, and a 30-minute default TTL.

Evidence:
- `node --test tests/auth/session-verifier.test.mjs tests/auth/customer-session-gateway.test.mjs` — PASS, 13/13 tests.
- `pnpm --filter @letbuyy/auth-core typecheck` — PASS.

### P0-A.2 / P0-A.3 — Gateway customer-session middleware and verifier rewrite

- Added `services/api-gateway/src/middleware/customer-session.ts`.
- Added `CUSTOMER_SESSION_SECRET` and `CUSTOMER_LEGACY_AUTH` to gateway env bindings.
- Rewrote `verifyStoreCustomer` through `getVerifiedStoreCustomer`, deriving authorization from `c.get('customer')` unless `CUSTOMER_LEGACY_AUTH=on`.
- Gateway accepts the new 30-minute session token and the existing signed customer JWT as a transition format, but no longer trusts body/query identity when secure mode is active.

Evidence:
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `node --test tests/auth/session-verifier.test.mjs tests/auth/customer-session-gateway.test.mjs` — PASS, 13/13 tests.

### P0-A.4 / P0-A.6 / P0-A.7 — First customer-route enforcement pass

- Protected session-proxied wishlist, orders, activity, profile, and address routes with `requireCustomerSession`.
- Customer login now returns a sanitized public profile, sets `lb_customer_session`, sets `letbuyy_csrf`, and never returns `password_hash`.
- Public checkout customer bootstrap now returns sanitized customer profiles instead of full `store_customers` rows.
- `/customer/by-email`, `/customer/status`, `/customer/password`, contact-order lookup, and legacy order-credential endpoints now require a signed internal `storefront` app request.
- Storefront-runtime server API client signs server-only legacy customer lookups and forwards the httpOnly customer session cookie to protected gateway customer routes.
- Storefront GraphQL `customer` and `order` fields now require a signed customer session and no longer delegate to `/customer/by-email`.
- Order and address routes use server-derived customer email from `store_customers`, not request-provided `email` / `customer_email`.

Evidence:
- `pnpm --filter @letbuyy/storefront-runtime typecheck` — PASS.
- `pnpm --filter @letbuyy/storefront-runtime lint` — PASS with 21 pre-existing warnings, 0 errors.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P0-A.5 — Token-bound customer password reset

- Added `database/supabase/migrations/077_customer_reset_tokens.sql` with `customer_credentials.reset_token_hash`, `reset_expires_at`, and `reset_used_at`.
- Relaxed `customer_credentials.password_hash` to allow reset-only credential rows without creating fake order passwords.
- Added gateway `/storefront/customer/password/request-reset` and `/storefront/customer/password/confirm-reset`.
- Reset tokens are high-entropy one-time values; only an HMAC hash scoped to store/email is stored.
- Public storefront `/api/customer/set-password` now requires `resetToken` and calls the confirm-reset path instead of the legacy email-only writer.
- Existing storefront `/api/customer/set-password` now supports non-mutating `action: "request_reset"` for enumeration-safe reset requests without adding a new app-local API route.

Evidence:
- `node --test tests/auth/session-verifier.test.mjs tests/auth/customer-session-gateway.test.mjs` — PASS, 14/14 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/shared-types build` — PASS; generated `dist` removed before governance.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after building referenced `@letbuyy/shared-types`.
- `pnpm --filter @letbuyy/storefront-runtime typecheck` — PASS.
- `pnpm --filter @letbuyy/storefront-runtime lint` — PASS with 21 pre-existing warnings, 0 errors.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P0-B — Identity set-password OTP-intent binding

- Added `database/supabase/migrations/078_password_set_intents.sql` for server-side one-time identity password-set intents.
- Added internal gateway create/consume endpoints for `auth_password_set_intents`.
- OTP verification and email-link verification now create a fresh intent and set its id in an HttpOnly `lb_password_set_intent` cookie.
- Identity `/api/auth/set-password` now reads the intent cookie, consumes it server-side, derives `user_id`/`email` from the consumed record, and ignores request-body identity.
- Added regression coverage for forged-body identity and one-time intent storage.

Evidence:
- `node --test tests/auth/identity-password-intent.test.mjs tests/auth/customer-session-gateway.test.mjs tests/auth/session-verifier.test.mjs` — PASS, 17/17 tests.
- `npx tsx --test apps/identity-platform/src/__tests__/auth-flow.test.ts` — PASS, 4/4 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/identity-platform typecheck` — PASS after restoring workspace dependency links.
- `pnpm --filter @letbuyy/identity-platform lint` — PASS with 12 pre-existing warnings, 0 errors.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P0-C — CSRF cookie contract and public storefront mutation coverage

- Renamed identity and mobile CSRF cookie writers to `letbuyy_csrf`.
- Kept one-release fallback reads for `lb_csrf` in identity and gateway CSRF validators.
- Added explicit CSRF middleware to public storefront review/contact mutations and session-backed customer wishlist/activity/profile/address mutations.
- Added regression coverage for the cookie-name contract and public storefront CSRF middleware.

Evidence:
- `node --test tests/auth/csrf-contract.test.mjs tests/auth/identity-password-intent.test.mjs tests/auth/customer-session-gateway.test.mjs tests/auth/session-verifier.test.mjs` — PASS, 20/20 tests.
- `npx tsx --test services/api-gateway/src/__tests__/security.test.ts apps/identity-platform/src/__tests__/auth-flow.test.ts` — PASS, 10/10 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/identity-platform typecheck` — PASS.
- `pnpm --filter @letbuyy/identity-platform lint` — PASS with 12 pre-existing warnings, 0 errors.
- `flutter analyze` from `apps/mobile/merchant-app` — PASS, no issues found.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after generated Dart artifacts were removed.

### P0-D — Customer-auth rate limit and Turnstile abuse controls

- Added gateway `verifyTurnstileToken` and `extractTurnstileToken` helpers with fail-closed production behavior.
- Added a dedicated `customerAuthRateLimit`/`enforceCustomerAuthRateLimit` path with per-IP and per-`store_id`+email/contact counters.
- Applied the limiter to customer login, customer password reset request/confirm, and guest order tracking lookup before credential/order reads.
- Added Turnstile checks to customer login before `bcrypt.compare`, public product review submission, and public contact submission.
- Extended the storefront review/API-client payload contracts with optional `turnstile_token`.
- Added a storefront-local invisible Turnstile widget and threaded tokens through customer login and product review submissions.
- Added regression coverage for the sixth login attempt throttle, fail-closed Turnstile verification, and route-order/source contracts.

Evidence:
- `node --test tests/auth/customer-abuse-controls.test.mjs tests/auth/csrf-contract.test.mjs tests/auth/identity-password-intent.test.mjs tests/auth/customer-session-gateway.test.mjs tests/auth/session-verifier.test.mjs` — PASS, 25/25 tests.
- `npx tsx --test services/api-gateway/src/__tests__/security.test.ts apps/identity-platform/src/__tests__/auth-flow.test.ts` — PASS, 13/13 tests after restoring workspace dependency links.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/storefront-runtime typecheck` — PASS.
- `pnpm --filter @letbuyy/commerce-core typecheck` — PASS after rebuilding `@letbuyy/shared-types` declarations.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after rebuilding `@letbuyy/shared-types` declarations.
- `pnpm --filter @letbuyy/storefront-runtime lint` — PASS with 21 pre-existing warnings, 0 errors.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after generated `packages/commerce-core/dist` was removed.

### P0-E.1 / P0-E.2 / P0-E.3 — Release workflow fail-closed and migration safety

- Added a `release-preflight` job to `.github/workflows/production-deploy.yml` that fails on missing Supabase, Cloudflare, Vercel, Worker, app, Turnstile, customer-session, and backup credentials.
- Removed production migration, Worker deployment, and app deployment skip branches so missing credentials cannot produce a green release.
- Moved api-gateway and webhook-service `wrangler secret put` steps before their production `wrangler deploy` steps.
- Added `CUSTOMER_SESSION_SECRET` and `TURNSTILE_SECRET_KEY` to api-gateway production Worker secret provisioning.
- Put production migrations behind the `production-migrations` environment, generated a Supabase migration diff artifact, and required an encrypted logical backup artifact before `supabase db push`.
- Added a `release-required-jobs-succeeded` job with `if: always()` that fails before production smoke when any required release job is failed, cancelled, or skipped.
- Added source regression tests for fail-closed credentials, migration diff/backup evidence, secrets-before-deploy ordering, and the required-job gate.

Evidence:
- `node --test tests/operations/production-deploy-workflow.test.mjs tests/operations/deployment-safety.test.mjs` — PASS, 6/6 tests.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P0-E.4 — WS11-13 production feature gates

- Added gateway feature flag helpers for `FEATURE_GRAPHQL`, `FEATURE_EXTENSIONS`, and `FEATURE_LIQUID`.
- Gated public and admin GraphQL route aliases behind `FEATURE_GRAPHQL`.
- Gated app extension registry routes and public checkout extension registry behind `FEATURE_EXTENSIONS`.
- Gated checkout app-function execution so extension functions do not run while `FEATURE_EXTENSIONS` is disabled.
- Set staging Worker defaults to enabled for proof and production Worker defaults to disabled for GraphQL, extensions, and Liquid.
- Added regression coverage for production-off defaults, route-gate ordering, and checkout function gating.

Evidence:
- `node --test tests/feature-flags/gateway-feature-gates.test.mjs tests/api-graphql/schema-contract.test.mjs tests/app-platform/app-bridge.test.mjs` — PASS, 20/20 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P0-E.5 — Release smoke suite

- Added `tests/e2e/smoke/release-gates.spec.ts` for identity login, storefront product read, checkout create, webhook bad-signature rejection, and gateway queue health.
- Added public gateway `/v1/health/queues` readiness metadata for release smoke without exposing queue contents.
- Wired canonical staging and production deploy workflows to run smoke tests with `LETBUYY_E2E_REQUIRE_REAL_STACK=1`, deployed service URLs, webhook URL, seeded identity credentials, Turnstile token, and smoke store subdomain.
- Added production release preflight checks for staging and production smoke identity credentials.
- Moved staging API and webhook Worker secret writes before their deploy steps and added staging `CUSTOMER_SESSION_SECRET` / `TURNSTILE_SECRET_KEY` provisioning.
- Added source regression coverage for smoke-suite gate presence, queue-health endpoint presence, workflow real-stack smoke wiring, and staging secrets-before-deploy ordering.

Evidence:
- `node --test tests/operations/release-smoke-suite.test.mjs tests/operations/production-deploy-workflow.test.mjs tests/operations/deployment-safety.test.mjs` — PASS, 10/10 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm exec playwright test --project=chromium tests/e2e/smoke/ --list` — PASS, 9 smoke tests discovered.
- `pnpm exec playwright test --project=chromium tests/e2e/smoke/release-gates.spec.ts` — PASS in local-safe mode with 5 expected skips after Chromium was rerun outside the sandbox.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P1-1 — Request-log sampling

- Added deterministic request-log sampling for `worker_request_logs` writes while keeping structured runtime console logs unchanged.
- Always records errors, auth routes, admin/operations/internal-console routes, payment routes, checkout order creation, and authenticated requests.
- Samples anonymous successful storefront GET/HEAD requests through `REQUEST_LOG_SAMPLE_RATE`, defaulting to `0.02` and rollbackable to full logging with `REQUEST_LOG_SAMPLE_RATE=1`.
- Adds request-log sample reason/rate metadata to recorded rows for observability audits.
- Added a batched `recordRequestLogs` adapter path for future producers that need to avoid one-row insert loops.
- Added `REQUEST_LOG_SAMPLE_RATE` to api-gateway Worker vars for default, staging, and production environments.

Evidence:
- `bash -c 'NODE_PATH="$PWD/node_modules/.pnpm/node_modules:$PWD/node_modules" npx tsx --test services/api-gateway/src/__tests__/observability.test.ts services/api-gateway/src/__tests__/security.test.ts'` — PASS, 13/13 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P1-4 — Cron no-op and routine completion event reduction

- Added a scheduled-dispatch preflight that checks pending outbox events, platform queue jobs, and webhook deliveries before claiming or dispatching work.
- Idle cron runs now log a `204` no-op result and return without outbox claims, queue claims, webhook dispatch, or routine completion events.
- `runtime.scheduled_dispatch.completed` now only enqueues when outbox, queue, or webhook work was actually claimed/processed.
- Scheduled failures now emit a separate `runtime.scheduled_dispatch.failed` event when the event queue is available.
- Reduced staging api-gateway cron cadence from every minute to every five minutes while keeping production at the existing one-minute cadence.

Evidence:
- `node --test tests/operations/cron-noop.test.mjs` — PASS, 4/4 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P1-5 — Worker log sampling config

- Lowered Cloudflare Worker observability head sampling from `1` to `0.1` for the api-gateway, queue-workers, and webhook-service default, staging, and production configs.
- Kept `observability.logs.enabled = true` and `invocation_logs = true` in every log section so sampled invocation logging remains active while cost exposure drops.
- Added a static regression test that rejects any canonical Worker config returning to full `head_sampling_rate = 1`.

Evidence:
- `node --test tests/operations/worker-log-sampling.test.mjs` — PASS, 2/2 tests.
- `node scripts/validators/cloudflare-environment-validator.mjs` — PASS, 3 Cloudflare Worker configs checked.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P1-6 — Atomic rate limiting and redundant limiter collapse

- Replaced Redis fixed-window rate checks with a single `EVAL` script and batched helper so customer-auth IP and identity buckets are charged in one atomic storage decision.
- Replaced Redis query-cost read-then-write with a single atomic leaky-bucket `EVAL` script.
- Made production fixed-window and query-cost rate limiting fail closed when Redis credentials are missing instead of falling back to non-atomic KV.
- Kept KV and in-memory fallback for non-production/local environments.
- Removed the protected-route fixed-window gateway limiter and added a query-cost skip list for auth, GraphQL, and dedicated customer-auth paths so hot requests pay one limiter, not two or three.

Evidence:
- `node --test tests/operations/rate-limit-collapse.test.mjs tests/federation/api-rate-versioning.test.mjs tests/api-graphql/schema-contract.test.mjs tests/auth/customer-abuse-controls.test.mjs` — PASS, 24/24 tests.
- `bash -c 'NODE_PATH="$PWD/node_modules/.pnpm/node_modules:$PWD/node_modules" npx tsx --test services/api-gateway/src/__tests__/security.test.ts'` — PASS, 9/9 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P1-7 — Queue write batching and GraphQL bulk single-path processing

- Changed queue-workers to normalize each Cloudflare queue batch in memory, upsert all `distributed_queue_messages` rows with one batched call, and write one aggregate `runtime_telemetry_metrics` row per batch.
- Removed per-message lag metric inserts; the aggregate batch metric now carries p95/max lag dimensions.
- Drains platform queues once per Cloudflare batch instead of once per message.
- Removed the unused GraphQL bulk queue enqueue path and kept one gateway `waitUntil` processor path.
- Stopped rewriting the actor bulk-operation index on every status transition; list/current reads hydrate operation objects from the append-only operation records.
- Bulk GraphQL mutations now fail loudly with `BULK_MUTATION_DIRECT_EXECUTION_REQUIRED` until direct execution adapters are wired, avoiding per-row full GraphQL HTTP fan-out.

Evidence:
- `node --test tests/operations/queue-bulk-cost.test.mjs tests/api-graphql/schema-contract.test.mjs` — PASS, 15/15 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/queue-workers typecheck` — PASS after restoring pnpm workspace links with `CI=true pnpm install --frozen-lockfile`; generated nested `node_modules` folders removed before governance.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P1-2 — Hyperdrive pooled-read decision

- Decision: keep the existing staging and production `HYPERDRIVE` bindings and implement pooled SQL reads in Phase 4.2 after P2-1 edge cache.
- Rationale: `docs/LETBUYY_CODEX_IMPLEMENTATION_MASTER.md` sequences P2-1 edge cache before P1-2 pooled reads so cache misses, not all storefront reads, move to the new DB access path.
- No code-path migration is done in Phase 3; the rollback flag and cache boundary will be introduced with the Phase 4 cache/pooled-read work.

Evidence:
- `rg -n "P1-2|Hyperdrive|pooled reads" docs/P1_COST_MASTER.md docs/P2_PERFORMANCE_MASTER.md docs/P3_SCALABILITY_MASTER.md docs/LETBUYY_CODEX_IMPLEMENTATION_MASTER.md services/api-gateway/wrangler.toml` — PASS, confirmed bindings exist and implementation order is cache first, pooled reads second.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P2-1 — Public storefront REST edge cache and publish invalidation

- Added a Cloudflare Cache API helper for public storefront JSON responses with `STOREFRONT_CACHE=off` rollback, 60-second max-age, and 300-second stale-while-revalidate.
- Cache-off and local no-cache paths now emit `Cache-Control: no-store`, so rollback disables both Worker cache writes and downstream public caching.
- Added versioned cache keys backed by the existing `CACHE` KV binding; theme publish and rollback bump the store handle version for subdomain, store name, and custom domain.
- Cached public REST storefront reads for bootstrap, product lists, product subsets, product detail, categories, navigation, pages, policies, and blog routes.
- Added store-scoped cache tags for provider-level purge observability without relying on tag purge for correctness.

Evidence:
- `node --test tests/performance/storefront-cache.test.mjs` — PASS, 5/5 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P1-2 / Phase 4.2 — Hyperdrive pooled SQL reads

- Added `@letbuyy/infrastructure/pooled-sql-adapter` using `postgres` against `HYPERDRIVE.connectionString`, with `DATABASE_URL`/`SUPABASE_DB_URL` local fallbacks.
- Exposed the adapter through the infrastructure package public exports and declared the `postgres` dependency in the owning package manifest and lockfile.
- Added gateway `HYPERDRIVE` and rollbackable `STOREFRONT_POOLED_SQL` bindings/vars for default, staging, and production Worker configs.
- Routed cache-miss hot reads through pooled SQL before Supabase fallback: published store handle resolution, published store/theme bootstrap, current theme release, and public product catalog reads.
- Kept writes, RPCs, customer auth, and provider mutation paths on existing Supabase/PostgREST clients.

Evidence:
- `node --test tests/performance/storefront-pooled-sql.test.mjs tests/performance/storefront-cache.test.mjs` — PASS, 9/9 tests.
- `pnpm --filter @letbuyy/payments build` — PASS; generated `packages/payments/dist` removed before governance.
- `pnpm --filter @letbuyy/infrastructure typecheck` — PASS after workspace links were restored; generated nested `node_modules` and `dist` folders removed before governance.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after artifact cleanup.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after generated artifact cleanup.

### P2-2 — Product view-counter de-hot

- Removed the `ProductExecutionAdapter.recordStorefrontView` read-modify-write path that updated `products.view_count` on product detail loads.
- Product detail cache misses now enqueue sampled `product.viewed` analytics events to `ANALYTICS_QUEUE` through `waitUntil`; cache hits do not execute the producer and do not enqueue/write.
- Added rollbackable `STOREFRONT_VIEW_SAMPLE_RATE`, defaulting to `0.1` in default, staging, and production Worker vars.
- Event payloads carry `sample_rate` and `sample_weight` for later projection/rollup weighting without blocking storefront rendering.

Evidence:
- `node --test tests/performance/product-view-counter.test.mjs tests/performance/storefront-cache.test.mjs tests/performance/storefront-pooled-sql.test.mjs` — PASS, 12/12 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P2-4 — Keyset pagination and default exact-count removal

- Added shared cursor pagination/query contracts: `cursor`, `withCount`, `next_cursor`, and `total_is_exact`.
- Added gateway cursor helpers and a cursor-compatible response envelope that preserves existing `meta.page`, `per_page`, and `has_next` fields.
- Replaced default exact-count list reads on products, orders, and media with explicit column projections, overfetch-by-one pagination, and exact counts only when `withCount=1`.
- Stopped expanding `order_items(*)` on the orders list path; order item fan-out remains on the order detail path.
- Preserved page-based fallback without running default `COUNT(*)`, while exposing cursor continuation for hot list paths.

Evidence:
- `node --test tests/performance/keyset-pagination.test.mjs tests/performance/storefront-cache.test.mjs tests/performance/storefront-pooled-sql.test.mjs tests/performance/product-view-counter.test.mjs` — PASS, 15/15 tests.
- `pnpm --filter @letbuyy/shared-types typecheck` — PASS.
- `pnpm --filter @letbuyy/commerce-core typecheck` — PASS after rebuilding referenced declarations.
- `pnpm --filter @letbuyy/checkout-core typecheck` — PASS after rebuilding referenced declarations.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after rebuilding referenced declarations.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after generated artifact cleanup.

### P2-5 — Trigram search indexes

- Added additive migration `084_trigram_search_indexes.sql`.
- Enabled `pg_trgm` and added GIN trigram indexes for leading-wildcard search columns used by products, orders, marketplace apps, themes, store lookup/internal store search, users, subscriptions, employees, audit logs, and media.
- Preserved the implementation runbook reservation for partition migrations `079-083`; this migration intentionally uses `084`.
- Added static regression coverage that verifies the extension, all expected `gin_trgm_ops` indexes, and additive-only SQL.

Evidence:
- `node --test tests/performance/trigram-search-indexes.test.mjs tests/performance/keyset-pagination.test.mjs tests/performance/storefront-cache.test.mjs tests/performance/storefront-pooled-sql.test.mjs tests/performance/product-view-counter.test.mjs` — PASS, 18/18 tests.
- `node scripts/validators/migration-safety-validator.mjs` — PASS, Supabase migration history checked for destructive replay hazards.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### P2-6 — Async R2 CSV export and capped import

- Replaced synchronous gateway `/export/products` and `/export/orders` CSV responses with `202` async export jobs.
- Export jobs write status JSON and streamed CSV results to `R2_BUCKET`, use selected columns, read in bounded `EXPORT_BATCH_SIZE` pages, and return signed download URLs through `/export/jobs/:id/download`.
- Added product import jobs backed by R2 source objects and `waitUntil` processing, capped at 500 rows per job.
- Updated the API client import result contract and merchant-control-plane import proxy/page to report queued background imports instead of synchronous completion.
- Added static regression coverage that rejects `select('*')`, in-memory CSV joins, uncapped import, and missing R2/signed-download job plumbing.

Evidence:
- `node --test tests/performance/async-export.test.mjs tests/performance/trigram-search-indexes.test.mjs tests/performance/keyset-pagination.test.mjs tests/performance/storefront-cache.test.mjs tests/performance/storefront-pooled-sql.test.mjs tests/performance/product-view-counter.test.mjs` — PASS, 21/21 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after rebuilding referenced declarations.
- `pnpm --filter @letbuyy/merchant-control-plane typecheck` — PASS after restoring workspace dependency links.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after generated artifact cleanup.

### P2-7 — Variant diff and checkout post-commit deferral

- Replaced the default product variant update path with a diff-based writer behind `PRODUCT_VARIANT_DIFF`, preserving the legacy delete/reinsert path as an explicit rollback switch.
- Added additive migration `088_inventory_available_batch.sql`, which wraps the existing `set_inventory_level_available` semantics in one batched RPC for variant inventory sync while keeping `087` reserved for Phase 6 theme template drafts.
- Split order post-commit work into `completeOrderPostCommitWork` and enabled storefront checkout to defer usage metering plus GST invoice persistence through `waitUntil` behind `CHECKOUT_POSTCOMMIT_DEFERRAL`.
- Kept admin order creation synchronous; only the public storefront checkout path defers post-commit work.
- Added static regression coverage for variant diffing, batched inventory sync, rollback flags, and checkout deferral.

Evidence:
- `node --test tests/performance/variant-checkout-deferral.test.mjs` — PASS, 4/4 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `node --test tests/performance/variant-checkout-deferral.test.mjs tests/performance/async-export.test.mjs tests/performance/trigram-search-indexes.test.mjs tests/performance/keyset-pagination.test.mjs tests/performance/storefront-cache.test.mjs tests/performance/storefront-pooled-sql.test.mjs tests/performance/product-view-counter.test.mjs` — PASS, 25/25 tests.
- `bash -c 'NODE_PATH="$PWD/node_modules/.pnpm/node_modules:$PWD/node_modules" npx tsx --test services/api-gateway/src/__tests__/products.test.ts services/api-gateway/src/__tests__/security.test.ts'` — PASS, 14/14 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after source test assertion refresh.
- `node scripts/validators/migration-safety-validator.mjs` — PASS.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

### Phase 5.1 — GraphQL fan-out and N+1 mitigation

- Added a nonce-backed internal REST-shim subrequest marker in `graphql/rest-shim.ts`; client-cloned headers are not trusted because only registered in-process markers bypass middleware cost.
- Skipped request-log writes and gateway query-cost limiting for verified internal GraphQL REST shim subrequests while keeping parent Admin/Storefront GraphQL query cost limits active.
- Changed Admin GraphQL sibling connection fields to resolve through a single `Promise.all(ADMIN_CONNECTION_FIELDS.map(...))` batch instead of serially awaiting each selected connection field.
- Refreshed REST-shim parity tests to match current cursor-paginated admin list envelopes and cached storefront REST envelopes.

Evidence:
- `node --test tests/api-graphql/fanout-cost.test.mjs tests/api-graphql/schema-contract.test.mjs tests/api-graphql/rest-shim-parity.test.mjs` — PASS, 16/16 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `git diff --check` — PASS.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators.

## VALIDATOR LEDGER

- `node --test tests/auth/session-verifier.test.mjs tests/auth/customer-session-gateway.test.mjs` — PASS, 13/13 tests.
- `node --test tests/auth/session-verifier.test.mjs tests/auth/customer-session-gateway.test.mjs` — PASS, 14/14 tests after token-bound reset coverage.
- `pnpm --filter @letbuyy/auth-core typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/shared-types build` — PASS; generated `dist` removed before governance.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS.
- `npx tsx --test apps/identity-platform/src/__tests__/auth-flow.test.ts` — PASS, 4/4 tests after OTP-intent binding coverage.
- `node --test tests/auth/identity-password-intent.test.mjs tests/auth/customer-session-gateway.test.mjs tests/auth/session-verifier.test.mjs` — PASS, 17/17 tests.
- `pnpm --filter @letbuyy/identity-platform typecheck` — PASS.
- `pnpm --filter @letbuyy/identity-platform lint` — PASS, warnings only.
- `pnpm --filter @letbuyy/storefront-runtime typecheck` — PASS.
- `pnpm --filter @letbuyy/storefront-runtime lint` — PASS, warnings only.
- `node --test tests/auth/csrf-contract.test.mjs tests/auth/identity-password-intent.test.mjs tests/auth/customer-session-gateway.test.mjs tests/auth/session-verifier.test.mjs` — PASS, 20/20 tests.
- `npx tsx --test services/api-gateway/src/__tests__/security.test.ts apps/identity-platform/src/__tests__/auth-flow.test.ts` — PASS, 10/10 tests.
- `flutter analyze` from `apps/mobile/merchant-app` — PASS, no issues found.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after generated install artifacts were removed.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after generated Dart artifacts were removed.
- `node --test tests/auth/customer-abuse-controls.test.mjs tests/auth/csrf-contract.test.mjs tests/auth/identity-password-intent.test.mjs tests/auth/customer-session-gateway.test.mjs tests/auth/session-verifier.test.mjs` — PASS, 25/25 tests.
- `npx tsx --test services/api-gateway/src/__tests__/security.test.ts apps/identity-platform/src/__tests__/auth-flow.test.ts` — PASS, 13/13 tests after restoring workspace dependency links.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/storefront-runtime typecheck` — PASS.
- `pnpm --filter @letbuyy/commerce-core typecheck` — PASS.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS.
- `pnpm --filter @letbuyy/storefront-runtime lint` — PASS, warnings only.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after generated `packages/commerce-core/dist` was removed.
- `node --test tests/operations/production-deploy-workflow.test.mjs tests/operations/deployment-safety.test.mjs` — PASS, 6/6 tests.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after production workflow fail-closed changes.
- `node --test tests/feature-flags/gateway-feature-gates.test.mjs tests/api-graphql/schema-contract.test.mjs tests/app-platform/app-bridge.test.mjs` — PASS, 20/20 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `git diff --check` — PASS after WS11-13 production feature gates.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after WS11-13 production feature gates.
- `node --test tests/operations/release-smoke-suite.test.mjs tests/operations/production-deploy-workflow.test.mjs tests/operations/deployment-safety.test.mjs` — PASS, 10/10 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after release smoke queue-health endpoint.
- `pnpm exec playwright test --project=chromium tests/e2e/smoke/ --list` — PASS, 9 smoke tests discovered.
- `pnpm exec playwright test --project=chromium tests/e2e/smoke/release-gates.spec.ts` — PASS in local-safe mode with 5 expected skips after sandbox-escalated Chromium launch.
- `git diff --check` — PASS after release smoke suite.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after release smoke suite.
- `bash -c 'NODE_PATH="$PWD/node_modules/.pnpm/node_modules:$PWD/node_modules" npx tsx --test services/api-gateway/src/__tests__/observability.test.ts services/api-gateway/src/__tests__/security.test.ts'` — PASS, 13/13 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after request-log sampling.
- `git diff --check` — PASS after request-log sampling.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after request-log sampling.
- `node --test tests/operations/cron-noop.test.mjs` — PASS, 4/4 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after cron no-op.
- `git diff --check` — PASS after cron no-op.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after cron no-op.
- `node --test tests/operations/worker-log-sampling.test.mjs` — PASS, 2/2 tests.
- `node scripts/validators/cloudflare-environment-validator.mjs` — PASS, 3 Cloudflare Worker configs checked after Worker log sampling.
- `git diff --check` — PASS after Worker log sampling.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after Worker log sampling.
- `node --test tests/operations/rate-limit-collapse.test.mjs tests/federation/api-rate-versioning.test.mjs tests/api-graphql/schema-contract.test.mjs tests/auth/customer-abuse-controls.test.mjs` — PASS, 24/24 tests.
- `bash -c 'NODE_PATH="$PWD/node_modules/.pnpm/node_modules:$PWD/node_modules" npx tsx --test services/api-gateway/src/__tests__/security.test.ts'` — PASS, 9/9 tests after atomic rate-limit changes.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after atomic rate-limit changes.
- `git diff --check` — PASS after atomic rate-limit changes.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after atomic rate-limit changes.
- `node --test tests/operations/queue-bulk-cost.test.mjs tests/api-graphql/schema-contract.test.mjs` — PASS, 15/15 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after GraphQL bulk single-path changes.
- `pnpm --filter @letbuyy/queue-workers typecheck` — PASS after queue write batching, with pnpm workspace links restored temporarily and nested generated `node_modules` removed afterward.
- `git diff --check` — PASS after queue write batching and GraphQL bulk single-path changes.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after queue write batching and GraphQL bulk single-path changes.
- `rg -n "P1-2|Hyperdrive|pooled reads" docs/P1_COST_MASTER.md docs/P2_PERFORMANCE_MASTER.md docs/P3_SCALABILITY_MASTER.md docs/LETBUYY_CODEX_IMPLEMENTATION_MASTER.md services/api-gateway/wrangler.toml` — PASS, Hyperdrive retained for Phase 4.2 pooled-read implementation.
- `git diff --check` — PASS after Hyperdrive pooled-read decision ledger update.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after Hyperdrive pooled-read decision ledger update.
- `node --test tests/performance/storefront-cache.test.mjs` — PASS, 5/5 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after public storefront REST cache changes.
- `git diff --check` — PASS after public storefront REST cache changes.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after public storefront REST cache changes.
- `node --test tests/performance/storefront-pooled-sql.test.mjs tests/performance/storefront-cache.test.mjs` — PASS, 9/9 tests.
- `pnpm --filter @letbuyy/payments build` — PASS as setup for infrastructure typecheck; generated `dist` removed before governance.
- `pnpm --filter @letbuyy/infrastructure typecheck` — PASS after Hyperdrive pooled SQL adapter and workspace link restore.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after Hyperdrive pooled SQL route changes and artifact cleanup.
- `git diff --check` — PASS after Hyperdrive pooled SQL route changes.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after Hyperdrive pooled SQL route changes and generated artifact cleanup.
- `node --test tests/performance/product-view-counter.test.mjs tests/performance/storefront-cache.test.mjs tests/performance/storefront-pooled-sql.test.mjs` — PASS, 12/12 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after product view-counter de-hot.
- `git diff --check` — PASS after product view-counter de-hot.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after product view-counter de-hot.
- `node --test tests/performance/keyset-pagination.test.mjs tests/performance/storefront-cache.test.mjs tests/performance/storefront-pooled-sql.test.mjs tests/performance/product-view-counter.test.mjs` — PASS, 15/15 tests.
- `pnpm --filter @letbuyy/shared-types typecheck` — PASS after cursor pagination contract changes.
- `pnpm --filter @letbuyy/commerce-core typecheck` — PASS after cursor query contract changes and referenced declaration rebuild.
- `pnpm --filter @letbuyy/checkout-core typecheck` — PASS after cursor query contract changes and referenced declaration rebuild.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after cursor metadata mapping and referenced declaration rebuild.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after product/order/media keyset list changes.
- `git diff --check` — PASS after keyset pagination and default exact-count removal.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after keyset pagination and generated artifact cleanup.
- `node --test tests/performance/trigram-search-indexes.test.mjs tests/performance/keyset-pagination.test.mjs tests/performance/storefront-cache.test.mjs tests/performance/storefront-pooled-sql.test.mjs tests/performance/product-view-counter.test.mjs` — PASS, 18/18 tests.
- `node scripts/validators/migration-safety-validator.mjs` — PASS after `084_trigram_search_indexes.sql`.
- `git diff --check` — PASS after trigram search index migration.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after trigram search index migration.
- `node --test tests/performance/async-export.test.mjs tests/performance/trigram-search-indexes.test.mjs tests/performance/keyset-pagination.test.mjs tests/performance/storefront-cache.test.mjs tests/performance/storefront-pooled-sql.test.mjs tests/performance/product-view-counter.test.mjs` — PASS, 21/21 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after async export route changes.
- `pnpm --filter @letbuyy/api-client typecheck` — PASS after async import contract update and referenced declaration rebuild.
- `pnpm --filter @letbuyy/merchant-control-plane typecheck` — PASS after import UI queued-state update and workspace link restore.
- `git diff --check` — PASS after async export/import changes.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after async export/import changes and generated artifact cleanup.
- `node --test tests/performance/variant-checkout-deferral.test.mjs tests/performance/async-export.test.mjs tests/performance/trigram-search-indexes.test.mjs tests/performance/keyset-pagination.test.mjs tests/performance/storefront-cache.test.mjs tests/performance/storefront-pooled-sql.test.mjs tests/performance/product-view-counter.test.mjs` — PASS, 25/25 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after variant diff and checkout deferral changes.
- `bash -c 'NODE_PATH="$PWD/node_modules/.pnpm/node_modules:$PWD/node_modules" npx tsx --test services/api-gateway/src/__tests__/products.test.ts services/api-gateway/src/__tests__/security.test.ts'` — PASS, 14/14 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after source test assertion refresh.
- `node scripts/validators/migration-safety-validator.mjs` — PASS after `088_inventory_available_batch.sql`.
- `git diff --check` — PASS after variant diff and checkout deferral changes.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after variant diff and checkout deferral changes.
- `node --test tests/api-graphql/fanout-cost.test.mjs tests/api-graphql/schema-contract.test.mjs tests/api-graphql/rest-shim-parity.test.mjs` — PASS, 16/16 tests.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS after GraphQL fan-out/N+1 mitigation.
- `git diff --check` — PASS after GraphQL fan-out/N+1 mitigation.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after GraphQL fan-out/N+1 mitigation.

## SKIPPED — NEEDS HUMAN

- SKIP: Live `CUSTOMER_SESSION_SECRET` provisioning and deployed-cookie verification — Reason: production/staging secret-store access is not available in this local environment. Resume point: Phase 2 release safety, before Worker deploy and smoke tests.
- SKIP: Apply migration `077_customer_reset_tokens.sql` and verify deployed reset-email delivery — Reason: live Supabase migration apply and Resend/provider credentials require human-controlled staging/prod access. Resume point: Phase 2 release safety migration gate and P0 customer-auth smoke suite.
- SKIP: Apply migration `078_password_set_intents.sql` and run deployed OTP→intent→set-password smoke — Reason: live Supabase migration apply and staging identity secrets require human-controlled access. Resume point: Phase 2 release safety migration gate and P0 identity auth smoke suite.
- SKIP: Provision and verify live `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for storefront-runtime and api-gateway — Reason: Cloudflare Turnstile site/secret keys and deployment secret-store access require human-controlled staging/prod access. Resume point: Phase 2 secrets-before-deploy gate and P0 storefront auth/contact/review smoke suite.
- SKIP: Execute `.github/workflows/production-deploy.yml` on a protected release branch with one credential intentionally unset — Reason: GitHub Actions protected environments and production secret store are human-controlled. Resume point: Phase 2 release workflow proof; expected result is hard failure in `release-preflight`, not skipped deploy jobs or green smoke.
- SKIP: Provision `PRODUCTION_BACKUP_ARTIFACT_PASSPHRASE` and validate encrypted production backup artifact restore in GitHub Actions — Reason: production backup encryption secret and database access are human-controlled. Resume point: Phase 2 migration safety proof before enabling production migrations.
- SKIP: Run the full release smoke suite with `LETBUYY_E2E_REQUIRE_REAL_STACK=1` on deployed staging and production — Reason: seeded smoke merchant credentials, smoke store/subdomain, live Worker redeploy with webhook secrets, and protected staging/production environments are human-controlled. Local-safe smoke currently skips the live checks; the reachable staging webhook returned 500 for bad Razorpay signature until secrets/redeploy are fixed. Resume point: Phase 2 release smoke proof; expected result is identity login, product read, checkout create, bad-signature 400, and queue health all green.
- SKIP: Configure and prove full-fidelity Cloudflare Logpush/error export for api-gateway, queue-workers, and webhook-service — Reason: Cloudflare account log destination, dataset selection, and provider credentials are human-controlled. Resume point: P1-5 observability cost proof; expected result is Worker head sampling at 10% plus provider-backed error/full-fidelity export evidence.
- SKIP: Apply `084_trigram_search_indexes.sql` to staging and capture `EXPLAIN (ANALYZE, BUFFERS)` proof for merchant search paths — Reason: live Supabase staging credentials and representative seeded datasets are human-controlled. Resume point: P2-5 search proof; expected result is Bitmap Index Scan/BitmapOr over trigram indexes for product/order/app/theme/internal-console search queries.
- SKIP: Run 100k-row products/orders export and capped product import against deployed staging R2 — Reason: representative staging dataset, live R2 bucket, and deployed Worker credentials are human-controlled. Resume point: P2-6 export proof; expected result is queued job completion, streamed R2 CSV download, no request-path memory spike, and import jobs capped at 500 rows.
- SKIP: Apply `088_inventory_available_batch.sql` to staging and run timed variant update plus checkout latency proof — Reason: live Supabase staging credentials, representative product variants, and deployed Worker timing telemetry are human-controlled. Resume point: P2-7 performance proof; expected result is one batched inventory RPC for changed variants, no delete/reinsert churn on unchanged variants, and storefront checkout response before usage/GST post-commit completion.
