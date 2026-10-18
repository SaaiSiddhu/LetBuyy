# F5.5 merchant inventory adjustment and audit — 4 October 2026

## Outcome

The merchant inventory page now assigns a key to each logical stock correction
and reuses the same key and exact delta after an ambiguous network failure. The
Next.js route forwards that key and the resolved owned store context to the
typed API client. Definitive HTTP failures refresh the inventory snapshot so a
subsequent edited quantity uses current stock.

The Gateway adjustment endpoint now scopes its product lookup by the resolved
store before checking ownership. Inventory History now constrains
`inventory_adjustments.store_id` directly, matching migration 245 and the
Gateway tenant-query guard.

## Verification

Source checkpoint: `0862687a5008d604d0df23357b2eb511293139fa`, branch
`letbuyy/phase2-shared-buyer-identity`.

| Check | Result |
| --- | --- |
| Owned Gateway suite `services/api-gateway/src/__tests__/owned-db/inventory-adjustment-audit.postgres.test.ts` | Pass, 1/1; 0 skipped; run `9ada22ddb673`; real worker + Postgres 16 + PostgREST |
| `pnpm --filter @letbuyy/api-gateway run typecheck` | Pass |
| `git diff --check` | Pass |
| `pnpm --filter @letbuyy/merchant-web run typecheck` | Not available: merchant app dependencies are absent (`next`, `react` and workspace modules cannot resolve) |

The real-worker test verifies concurrent `+2` and `+3` corrections both persist,
the variant's available quantity and storefront cache become nine, and two
actor-attributed adjustments plus two outbox events are recorded. Replaying one
request with the same key and body but a fresh request ID returns
`X-Idempotent-Replay: true` and adds no stock or audit effect. A `-10` adjustment
is rejected without changing stock, audit or outbox. The owner reads both audit
rows from `/inventory/history`; an unrelated signed merchant cannot adjust the
product and receives an empty history result. The test uses an owned disposable
database; runner cleanup removed its Postgres/PostgREST resources.

## Findings and limits

The first real-worker attempts found the normal adjustment path omitted the
required idempotency key/site context. After adding those, the tenant guard
exposed an unscoped product lookup and Inventory History's indirect join-only
scope. All were fixed and the final owned suite passes. Merchant-web typecheck
and normal browser/device acceptance remain open because the app dependencies
are absent in this checkout. This slice does not close F5.5 or Phase 5; timeout
release, late capture, merchant device/UI behavior and remaining catalog,
compliance and discovery journeys remain open.

## 5 October merchant browser acceptance

The existing owned Chromium journey now continues into Merchant's real
Inventory screen after the authenticated store is created. It loads a synthetic
tracked product through the same-origin BFF and real Gateway worker, changes
available stock from 4 to 9, and verifies the `POST /inventory/adjust` response
is 200. Owned Postgres readback confirms quantity 9, one actor-attributed
adjustment with delta +5, and one `inventory.level.adjusted` outbox event. The
screen is reloaded and displays the persisted quantity.

The owned browser runner passes **1/1** with no failures, skips, cancellations
or TODOs (`71fb3a4085b9`, Postgres 16 and PostgREST); its disposable database,
sidecar, network and volume were cleaned. This verifies one synthetic local
merchant web journey. Normal sign-in, device acceptance, hosted behavior,
timeouts/late capture and the other Phase 5 requirements remain open. The test
shares the existing onboarding browser fixture; no production behavior or
database migration changed in this continuation.
