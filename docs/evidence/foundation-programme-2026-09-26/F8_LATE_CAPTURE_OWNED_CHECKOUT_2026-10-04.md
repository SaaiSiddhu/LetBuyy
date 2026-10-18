# F8 late capture after reservation release — 4 October 2026

## Delivered and verified locally

Added a cross-layer regression to the existing hosted-checkout owned-database suite. It runs the actual API Gateway worker against PostgREST and the runner-owned PostgreSQL fixture. A synthetic buyer creates a Razorpay-mode checkout with an explicitly test-only adapter; the reservation sweeper releases the unpaid order, then confirmation receives a captured-payment response with a valid fixture HMAC. The journey proves that the captured payment is recorded once, the cancelled and inventory-released order is not fulfilled, one refund obligation remains pending, no `order.paid` event is emitted, the checkout is marked failed, and the same confirmation retry replays without a provider lookup or duplicate money effect.

The reservation-release control verifies the intended inventory transition: one unit moves from committed back to available while total available stock, reserved stock, and reserved quantity projections remain unchanged. The runner-owned containers, database, volume and network were removed with no leftovers.

## Verification

| Check | Result |
|---|---|
| `node scripts/governance/run-executable-suites.mjs --gateway-db --filter hosted-checkout-buyer-ownership --timeout 900 --jobs 1 --log-dir /private/tmp/letbuyy-hosted-late-capture-final --json-out /private/tmp/letbuyy-hosted-late-capture-final/report.json` | **8/8 passed**, zero failures/skips/TODOs/cancellations; run `8a2836646cbe`. Real Gateway worker + PostgREST + runner-owned PostgreSQL 16. Cleanup reports no remaining containers, networks or volumes. |
| `pnpm --filter @letbuyy/api-gateway run typecheck` | Passed. |
| `git diff --check -- services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts` | Passed. |

This is local synthetic-provider evidence. The adapter declares sandbox mode but does not contact Razorpay's sandbox or establish provider behavior; no production payment, refund transaction, hosted environment, browser/device journey, deployment, RLS role acceptance or formal phase approval is claimed. Remaining Phase 8 work includes actual provider-sandbox callback/reconciliation, refund execution, fulfillment and partial-failure coverage, channel/device acceptance, commercial shipping/COD/refund decisions, and marketplace online-payment eligibility. Phase 8 and the eleven-phase programme remain open.
