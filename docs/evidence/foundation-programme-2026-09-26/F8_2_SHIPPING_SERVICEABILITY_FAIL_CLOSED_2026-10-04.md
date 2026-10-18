# F8.2 shipping serviceability fail-closed correction — 4 October 2026

## Local change

The authenticated Gateway shipping quote endpoints no longer treat absent
`shipping_serviceability_rules` as universal carrier coverage, and they no
longer invent a ₹60 `sandbox-standard` rate when the merchant has no matching
rate. An empty rule set now yields no serviceable result; database lookup
failures return `503 SHIPPING_CONFIGURATION_UNAVAILABLE`. Rate lookup failures
also return 503 rather than returning a partial quote.

Changed files:

- `services/api-gateway/src/routes/shipping.ts`
- `services/api-gateway/src/__tests__/shipping.test.ts`

## Verification

| Check | Result |
|---|---|
| `node --import tsx --test services/api-gateway/src/__tests__/shipping.test.ts` | **8/8 passed**, including the empty-configuration behavior and fail-closed contract. |
| `pnpm --filter @letbuyy/api-gateway run typecheck` | Passed. |
| `git diff --check -- services/api-gateway/src/routes/shipping.ts services/api-gateway/src/__tests__/shipping.test.ts` | Passed. |

The `tsx --test` launcher could not open its IPC pipe under the sandbox; running
the same Node test suite with `node --import tsx` passed. No database or carrier
was contacted, and no shared or hosted configuration changed.

## 4 October continuation — normal buyer checkout integration

The follow-on task below is implemented locally in
[`F8_3_STOREFRONT_SHIPPING_RATE_SELECTION_2026-10-04.md`](F8_3_STOREFRONT_SHIPPING_RATE_SELECTION_2026-10-04.md).
The buyer-facing checkout now retrieves only published-store, address- and
subtotal-matching seller rates, requires an explicit selection, submits the
reviewed amount, and binds that rate/address/COD decision to canonical order
creation. This supersedes the statement below that normal checkout still uses
the free/₹99 fallback. The owned Postgres transaction suite remains pending;
the local Docker daemon was unavailable, so migration 281 and the locking/RPC
path have not been runtime exercised.

## Limits and next task

This corrects the authenticated shipping-configuration API only. The normal
Commerce storefront checkout still has its own legacy free/₹99 fallback and its
rate-fetch BFF points to this merchant-authenticated endpoint. This change does
not make buyer shipping-rate selection work end to end. Next, connect a public,
store-subdomain-bound, address- and subtotal-aware quote to the normal checkout
screen, then require the selected quote to be revalidated against the submitted
address and order at the server boundary. Continue to label seller estimates as
unconfirmed by a live carrier. Phase 8 and the eleven-phase goal remain open.
