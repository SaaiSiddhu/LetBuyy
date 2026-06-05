# CODEX REMEDIATION LEDGER

## CURRENT PHASE

- Phase: PHASE 1 — P0 Security.
- Current work item: P0-A customer-session primitive and gateway enforcement.
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

## VALIDATOR LEDGER

- `node --test tests/auth/session-verifier.test.mjs tests/auth/customer-session-gateway.test.mjs` — PASS, 13/13 tests.
- `pnpm --filter @letbuyy/auth-core typecheck` — PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` — PASS.
- `pnpm --filter @letbuyy/storefront-runtime typecheck` — PASS.
- `pnpm --filter @letbuyy/storefront-runtime lint` — PASS, warnings only.
- `node scripts/validate-governance.mjs` — PASS, 128/128 validators after generated install artifacts were removed.

## SKIPPED — NEEDS HUMAN

- SKIP: Live `CUSTOMER_SESSION_SECRET` provisioning and deployed-cookie verification — Reason: production/staging secret-store access is not available in this local environment. Resume point: Phase 2 release safety, before Worker deploy and smoke tests.
