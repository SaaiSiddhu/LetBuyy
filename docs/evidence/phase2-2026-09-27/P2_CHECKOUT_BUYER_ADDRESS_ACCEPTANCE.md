# Phase 2 — canonical buyer addresses in storefront checkout

Date: 4 October 2026 (Asia/Kolkata)

## Outcome

Normal storefront checkout now verifies the host-bound buyer session before loading saved
addresses. When a canonical buyer is signed in, checkout loads the buyer address book through
`/api/buyer/addresses`. Only when the buyer session is verified as signed out does it use the
separate legacy store-customer address endpoint. Session-verification or address-load failures
remain visible to the shopper and allow manual address entry; they are not converted into an
empty address book and do not trigger a fallback into the other identity realm.

The checkout-origin page continues to skip saved-address retrieval. Its host cannot read the
storefront's host-bound session, and the signed cart handoff does not carry address PII.

## Verification

| Check | Result |
|---|---|
| `node --import tsx --test src/lib/checkout/saved-addresses.test.ts` | 4/4 passed: canonical buyer selection, explicit legacy selection after verified sign-out, fail-closed buyer verification and visible address-load failure |
| `pnpm --filter @letbuyy/customer-web typecheck` | Passed |
| `git diff --check` | Passed |

## Limits and next work

This is local implementation and unit evidence. No browser/provider sign-in, hosted origin,
deployed telemetry, or hosted checkout session was exercised. The wider Phase 2 identity transition
remains open: legacy password login/reset issuance, route-by-route consumer retirement, and
observable reversible verifier gates still need their own evidence and compatibility decisions.
This closes only the normal storefront checkout address-selection gap for an already-issued
canonical buyer session.
