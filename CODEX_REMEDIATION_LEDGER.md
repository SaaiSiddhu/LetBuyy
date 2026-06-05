# CODEX REMEDIATION LEDGER

## CURRENT PHASE

- Phase: PHASE 2 — Release Safety.
- Current work item: P0-E WS11-13 production feature gates and smoke suite.
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

## SKIPPED — NEEDS HUMAN

- SKIP: Live `CUSTOMER_SESSION_SECRET` provisioning and deployed-cookie verification — Reason: production/staging secret-store access is not available in this local environment. Resume point: Phase 2 release safety, before Worker deploy and smoke tests.
- SKIP: Apply migration `077_customer_reset_tokens.sql` and verify deployed reset-email delivery — Reason: live Supabase migration apply and Resend/provider credentials require human-controlled staging/prod access. Resume point: Phase 2 release safety migration gate and P0 customer-auth smoke suite.
- SKIP: Apply migration `078_password_set_intents.sql` and run deployed OTP→intent→set-password smoke — Reason: live Supabase migration apply and staging identity secrets require human-controlled access. Resume point: Phase 2 release safety migration gate and P0 identity auth smoke suite.
- SKIP: Provision and verify live `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for storefront-runtime and api-gateway — Reason: Cloudflare Turnstile site/secret keys and deployment secret-store access require human-controlled staging/prod access. Resume point: Phase 2 secrets-before-deploy gate and P0 storefront auth/contact/review smoke suite.
- SKIP: Execute `.github/workflows/production-deploy.yml` on a protected release branch with one credential intentionally unset — Reason: GitHub Actions protected environments and production secret store are human-controlled. Resume point: Phase 2 release workflow proof; expected result is hard failure in `release-preflight`, not skipped deploy jobs or green smoke.
- SKIP: Provision `PRODUCTION_BACKUP_ARTIFACT_PASSPHRASE` and validate encrypted production backup artifact restore in GitHub Actions — Reason: production backup encryption secret and database access are human-controlled. Resume point: Phase 2 migration safety proof before enabling production migrations.
- SKIP: Run the full release smoke suite with `LETBUYY_E2E_REQUIRE_REAL_STACK=1` on deployed staging and production — Reason: seeded smoke merchant credentials, smoke store/subdomain, live Worker redeploy with webhook secrets, and protected staging/production environments are human-controlled. Local-safe smoke currently skips the live checks; the reachable staging webhook returned 500 for bad Razorpay signature until secrets/redeploy are fixed. Resume point: Phase 2 release smoke proof; expected result is identity login, product read, checkout create, bad-signature 400, and queue health all green.
