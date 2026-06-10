# LetBuyy Foundation Step-Up - Ledger

Append-only ledger for the 2026-06-07 foundation hardening pass.

## A1 - Close public customer PII endpoint

Summary: `POST /storefront/customer/find-or-create` now requires a signed storefront-internal request before validation or database access.
Files touched: `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts`, `apps/storefront-runtime/src/lib/api/client.ts`, `services/api-gateway/src/__tests__/customer-engagement.security.test.ts`.
Real test: unsigned caller returns unauthorized and does not touch DB; valid internal signature reaches the handler.
Fails without fix: the unsigned test would reach the handler and record DB access.

## A2 - Resolve legacy customer-auth bypass

Summary: `CUSTOMER_LEGACY_AUTH` body-trusted auth was deleted. Investigation found no first-party dependency requiring body-supplied `customer_id`; storefront server calls use signed internal requests and customer-account paths use signed sessions.
Files touched: `services/api-gateway/src/middleware/customer-session.ts`, `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts`, `services/api-gateway/src/routes/storefront.ts`, `services/api-gateway/src/index.ts`, tests.
Real test: `CUSTOMER_LEGACY_AUTH` no longer bypasses `requireCustomerSession`, and body-supplied `customer_id` cannot read another customer.
Fails without fix: setting `CUSTOMER_LEGACY_AUTH=true` would allow sessionless customer-account access.

## A3 - Authorize R2 deletes and fix key derivation

Summary: Upload deletes derive object keys from the validated wildcard route param, strip `/v1` pollution, and require R2 metadata ownership.
Files touched: `services/api-gateway/src/routes/upload.ts`, `services/api-gateway/src/__tests__/upload.security.test.ts`.
Real test: foreign-owner delete returns 403 without deleting; owner delete succeeds; key derivation excludes route prefix.
Fails without fix: foreign-owned objects could be deleted and `/v1` could be embedded in the key.

## A4 - Harden optional auth role precedence

Summary: `optionalAuth` now prefers app metadata role over user metadata, matching hardened auth middleware.
Files touched: `services/api-gateway/src/middleware/auth.ts`, auth/security tests.
Real test: token with `user_metadata.role=super_admin` and no authoritative grant is non-privileged.
Fails without fix: user-controlled metadata could elevate optional-auth context.

## A5 - Scope leaky reads/writes and fix contacts

Summary: Coupon validation, notification preference/log surfaces, and contacts now require auth/internal scope and ownership checks instead of public/body-trusted scope.
Files touched: `services/api-gateway/src/routes/coupons.ts`, `services/api-gateway/src/routes/notifications.ts`, `services/api-gateway/src/routes/contacts.ts`, tenant/security tests.
Real test: cross-store coupon validation is denied, unauth contacts no longer 500, log endpoints are not public leakage points.
Fails without fix: cross-store enumeration and unauthenticated contacts 500 remain reachable.

## B1 - Orders tenant key not null

Summary: Added migration `108_orders_tenant_key_not_null.sql`; canonical tenant key is `orders.store_id`, backfilled from `site_id`, guarded before `SET NOT NULL`.
Files touched: `database/supabase/migrations/108_orders_tenant_key_not_null.sql`, `services/api-gateway/src/__tests__/orders-data-integrity.test.ts`, `tests/migrations/orders-hardening.test.mjs`.
Real test: migration order/guard is asserted and order creation derives `store_id` from resolved store context.
Fails without fix: order rows could remain tenant-null or created from client/body scope.

## B2 - Transactional order confirmation email

Summary: Paid-order flows enqueue idempotent order-confirmation email payloads from relational `order_items`; queue worker sends via Resend and mail failures are fail-soft.
Files touched: `services/api-gateway/src/lib/order-confirmation-email.ts`, `services/api-gateway/src/routes/payments.ts`, storefront payment confirmation paths, `services/queue-workers/src/index.ts`, `services/api-gateway/src/__tests__/order-confirmation-email.test.ts`.
Real test: duplicate paid event creates exactly one receipt payload to the correct recipient with order id and relational lines.
Fails without fix: no confirmation event is produced or duplicate events produce duplicate receipts.

## B3 - Relational read canonical for dual models

Summary: Relational order/item reads are canonical; reconciliation reporting detects divergence between JSONB caches and relational truth, with scheduled trigger human-gated.
Files touched: gateway/order read paths, reconciliation report contracts, tests.
Real test: divergent JSONB versus relational rows report divergence and reads return relational data.
Fails without fix: stale JSONB cache can override relational truth.

## B4 - Money width

Summary: Added migration `109_orders_money_width.sql` to widen storefront order money columns to `numeric(12,2)` while preserving platform billing minor-unit model.
Files touched: `database/supabase/migrations/109_orders_money_width.sql`, `docs/governance/storefront-money-model.md`, `tests/migrations/orders-hardening.test.mjs`.
Real test: migration contract asserts order money columns are not narrower than cart counterparts.
Fails without fix: valid cart totals can overflow on order copy.

## B5 - GDPR export and erasure

Summary: Added ownership-scoped customer data export and erasure/anonymization path; legal sign-off and EU UX controls remain human-gated.
Files touched: `services/api-gateway/src/routes/customers.ts`, `services/api-gateway/src/__tests__/tenant-isolation.test.ts`, compliance docs/status.
Real test: export/erase require owned store scope; erase redacts customer/order PII while preserving financial records.
Fails without fix: cross-store export/erase or PII retention after erase remains possible.

## C1 - Shared security headers and CSP

Summary: Added shared Next security header helper and applied HSTS, CSP, frame, referrer, content-type, and permissions headers to every Next app.
Files touched: `config/security/next-security-headers.ts`, every active Next app `next.config.ts`, `tests/contracts/security-headers.test.ts`.
Real test: every Next app emits required headers and non-empty `default-src`/`script-src`.
Fails without fix: apps without CSP/HSTS are detected.

## D1 - Canonical `.com` default

Summary: `letbuyy.com` is the default canonical platform domain; `.store` remains accepted alias during transition.
Files touched: `packages/shared-types/src/brand.ts`, SEO/storefront URL helpers and tests.
Real test: `.com` default appears in canonical platform surfaces; `.store` alias remains accepted.
Fails without fix: SEO/display defaults continue emitting `.store`.

## D2 - Env-drive functional `.store` literals

Summary: Functional `.store` literals in payments, auth/reset, marketing CTAs, theme URLs, onboarding, permission, and middleware paths now resolve through shared/domain env helpers.
Files touched: app/service URL helpers, `scripts/validators/platform-domain-literal-validator.mjs`, governance runner.
Real test: platform-domain literal validator parses functional files and fails on unwrapped `letbuyy.store`.
Fails without fix: hardcoded `.store` remains in runtime-sensitive paths.

## D3 - Realm config staged

Summary: Realm values are env-driven with production mismatch checks for platform domain, cookie domain, CORS origins, and `.com` config templates.
Files touched: env config/templates, Cloudflare binding ownership, environment honesty tests.
Real test: production realm mismatches fail loudly; placeholder secrets are rejected.
Fails without fix: `.com` deploy can silently run with `.store` cookie/CORS assumptions.

## D4 - Storefront browser calls same-origin

Summary: Storefront browser API calls now go through same-origin `/api/storefront/:subdomain/*` rewrites, using shared API path conversion without browser env API-base reads.
Files touched: `apps/storefront-runtime/src/lib/api/browser-client.ts`, `apps/storefront-runtime/next.config.ts`, API-client contracts.
Real test: browser client has no direct API host/env fallback and constructs same-origin proxy paths through shared path helpers.
Fails without fix: custom-domain storefront browsers call cross-origin API directly.

## D5 - Mobile `.com` via dart-define

Summary: Mobile defaults and production dart-defines use `.com`; release commands require `--dart-define` host values.
Files touched: `apps/mobile/merchant-app/lib/config/app_config.dart`, `apps/mobile/merchant-app/dart-defines/production.json`, Dart constants/tests.
Real test: Flutter analyze and tests pass; host config reads from environment defines.
Fails without fix: shipped app keeps `.store` baked defaults.

## D6 - Cutover runbook

Summary: Ordered human `.com` cutover is recorded in STATUS with DNS, cert, Vercel, Worker, secret, env, verification, redirect, and mobile release commands.
Files touched: `CODEX_FOUNDATION_STEPUP_STATUS.md`.
Real test: not a runtime test; the runbook is an explicit human-gated operational artifact.
Fails without fix: cutover remains tribal and unordered.

## E1 - Un-orphan backend tests

Summary: Gateway `src/__tests__` are wired to `test:unit` and root `test:unit:gateway`.
Files touched: `services/api-gateway/package.json`, root `package.json`.
Real test: `pnpm run test:unit:gateway` executes 47 tests.
Fails without fix: real backend tests remain orphaned.

## E2 - Full-repo typecheck and CI gate

Summary: CI now has an unfiltered merge gate for full typecheck plus gateway unit, behavioral, and contract tests; governance installs deps before claiming build facts.
Files touched: `.github/workflows/ci.yml`.
Real test: CI contract tests assert the gate exists and orders behavioral checks before filtered workspace tests.
Fails without fix: safety-critical jobs can be skipped by `...[HEAD^1]`.

## E3 - Route ownership gate

Summary: Added real route ownership validator for tenant-scoped route handlers with explicit ownership/session/internal gates.
Files touched: `scripts/validators/route-ownership-validator.mjs`, governance runner.
Real test: validator parses gateway route modules and fails missing ownership gates unless explicitly allowlisted.
Fails without fix: future tenant table handlers can omit ownership checks.

## E4 - Real cycle budget

Summary: Added honest cycle-budget validator with current ceiling `3/3` file-level cycle components; no fake zero-cycle claim.
Files touched: `scripts/validators/cycle-budget-validator.mjs`, governance docs.
Real test: validator fails if cycle count grows past budget.
Fails without fix: circular import risk remains falsely reported as zero.

## E5 - Stop committing/generated artifacts

Summary: Removed local generated `.next`, `.turbo`, `dist`, nested `node_modules`, and Dart `.dart_tool` pollution after gate runs.
Files touched: generated outputs only; no source authority depends on generated folders.
Real test: stale artifact validator passes on the final handoff tree.
Fails without fix: governance fails and generated output remains source-adjacent pollution.

## E6 - Validator honesty pass

Summary: Added validator reality documentation and stopped treating raw validator count as readiness.
Files touched: `docs/governance/validator-reality.md`, STATUS.
Real test: governance passes with real gates named; docs classify readiness signals.
Fails without fix: raw validator count continues to overstate production readiness.

## F1 - FK hygiene

Summary: Added migration `110_fk_hygiene_and_order_indexes.sql` for missing delete behavior, `orders.site_id` index, and tenant/RLS documentation for parent-scoped tables.
Files touched: `database/supabase/migrations/110_fk_hygiene_and_order_indexes.sql`, migration tests.
Real test: migration lint checks idempotent guarded FK/index operations.
Fails without fix: FK behavior and order index gaps persist.

## F2 - Migration idempotency

Summary: Bare migration DDL in the specified range is guarded/idempotent or covered by forward-only idempotency lint.
Files touched: migration files and `tests/migrations/orders-hardening.test.mjs`.
Real test: migration lint catches bare unsafe replay patterns.
Fails without fix: replaying applied migrations can fail destructively.

## F3 - Customer credential source of truth

Summary: New writes use `customer_credentials`; inline `store_customers.password_hash` is no longer the source of truth.
Files touched: `database/supabase/migrations/111_customer_credentials_source_of_truth.sql`, `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts`, tests.
Real test: customer login/password flows read/write credentials table and do not trust inline duplicate.
Fails without fix: two password sources can diverge.

## F4 - Push config

Summary: Push provider secrets remain human-gated and placeholder values are rejected/fail loud in production config.
Files touched: queue-worker config/secret governance and STATUS skipped commands.
Real test: Cloudflare binding/secret placeholder validators pass.
Fails without fix: production can silently run placeholder push credentials.

## F5 - Search follow-up

Summary: Trigram-only search remains acceptable for launch; `tsvector` ranking is logged as follow-up instead of blocking P0/P1.
Files touched: STATUS skipped/follow-up notes.
Real test: no code test added by design; this is an explicit P2 product/search follow-up.
Fails without fix: none for launch; future ranking quality remains a planned enhancement.
