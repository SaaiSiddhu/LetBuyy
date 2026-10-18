# Authenticated checkout ownership — 4 October 2026

## Outcome

The checkout creation path now carries the canonical storefront buyer session from the host-only
cookie through the commerce API route to the gateway. The gateway validates the signed session
against the published store and live account epoch before it may replay an idempotency result. It
derives buyer identity only from that verified context. Guest checkout continues to use the existing
canonical order RPC.

Authenticated orders use migration 267's service-role-only
`create_checkout_order_for_buyer` wrapper. The wrapper serializes the site's idempotency key, checks
the account status and session epoch under a row lock, refuses to claim an earlier guest or another
buyer's order, invokes `create_checkout_order`, and inserts the single
`buyer_order_links` row with `link_basis='authenticated_checkout'` in the same database transaction.
It returns the canonical order row. Migration rollback is paired at
`database/supabase/rollback/267_authenticated_checkout_order_ownership.rollback.sql`.

## Local verification

| Check | Result |
| --- | --- |
| `pnpm --filter @letbuyy/api-gateway run typecheck` | Pass, exit 0 |
| `pnpm --filter @letbuyy/customer-web run typecheck` | Pass, exit 0 |
| `node --import tsx --test services/api-gateway/src/__tests__/*.test.ts` | 1343 pass, 0 fail, 1 existing TODO; exit 0 |
| `TMPDIR=/private/tmp node --conditions react-server --import tsx --test src/app/api/orders/route.test.ts` from `apps/commerce/web` | 4/4 pass, including session-header forwarding and wrong-store denial |
| `node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/authenticated-checkout.postgres.test.ts --kind gateway-db --jobs 1 --json-out …` | 5/5 pass on an owned disposable Postgres database; migration apply, role grants/refusals, transaction behavior, rollback and reapply are exercised. Sanitized runner report: [P2_AUTHENTICATED_CHECKOUT_DATABASE_RUN.json](P2_AUTHENTICATED_CHECKOUT_DATABASE_RUN.json) |
| `pnpm --filter @letbuyy/api-gateway run test:db` | 119/119 pass, 19 suites, zero failures/skips/TODO; final run `97de14e8217c` |

The new real-worker owned-Postgres acceptance suite is
`services/api-gateway/src/__tests__/owned-db/authenticated-checkout.postgres.test.ts`. It covers an
unlinked guest order, a signed buyer-owned order, stable replay, wrong-site/revoked/disabled sessions,
a forged body buyer selector, revocation racing the order RPC, backend-only function access, and
rollback/reapply preserving existing ownership. Migration 267 was applied only to the suite's
disposable database and then rolled back/reapplied there; it was not applied to a developer or hosted
database.

## Acceptance boundary and next action

Status: **locally implemented and owned-database accepted; not deployed**. The existing React and
Liquid account order surfaces already read only explicit signed-site `buyer_order_links`; this
checkout writer now supplies that same canonical edge. No live browser sign-in, hosted identity
session, real provider transaction, or cross-device journey is claimed. The broader hosted checkout
state-machine/provider work remains a separate Phase 8 acceptance and is not closed by this Phase 2
ownership link.
